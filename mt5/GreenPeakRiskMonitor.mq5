#property copyright "GreenPeak"
#property version   "1.00"
#property strict
#property description "Read-only portfolio risk monitor and GreenPeak snapshot sender"

input double FinalLeverage=10.0;
input double MaxLeverage=4.0;
input int LocalRefreshSeconds=5;
input bool AutoSendEnabled=false;
input int AutoSendIntervalSeconds=30;
input bool BrokerSamplingEnabled=false;
input int BrokerSamplingIntervalSeconds=5;
input int SwapSpecificationRefreshHours=24;
input string GreenPeakApiUrl="https://greenpeak.ir/api/v1/mt5/snapshots";
input string GreenPeakApiToken="";
input bool EnableLocalBackup=false;
input color TextColor=clrWhite;
input string FontName="Arial";
input int FontSize=11;
input int XOffset=15;
input int YOffset=15;
input int LineSpacing=22;

#define EA_NAME "GreenPeak MT5 Risk Monitor"
#define EA_VERSION "1.00"
#define SCHEMA_VERSION "1.0"
#define PREFIX "GP_RISK_"

struct SymbolRisk {
  string symbol,status,break_even_status,final_leverage_status,swap_status;
  double net_usd,long_usd,short_usd,net_leverage,break_even,final_price;
  double long_swap_pct,short_swap_pct,annual_swap_usd,required_deposit;
  double next_buy_leverage,next_sell_leverage;
  int positions,long_count,short_count;
};

SymbolRisk current;
double portfolio_net_usd=0,portfolio_gross_usd=0,portfolio_swap_usd=0;
int account_positions=0,account_longs=0,account_shorts=0;
string send_status="Ready";
datetime last_send=0;

string JEsc(string s) {
  StringReplace(s,"\\","\\\\"); StringReplace(s,"\"","\\\"");
  StringReplace(s,"\r","\\r"); StringReplace(s,"\n","\\n"); return s;
}
double Unavailable(){ return MathArcsin(2.0); }
string JStr(string s){ return "\""+JEsc(s)+"\""; }
string JNum(double v,int digits=8){ if(!MathIsValidNumber(v)) return "null"; return DoubleToString(v,digits); }
string JBool(bool v){ return v?"true":"false"; }
string Iso(datetime t){ string value=TimeToString(t,TIME_DATE|TIME_SECONDS);StringReplace(value,".","-");StringReplace(value," ","T");return value+"Z"; }

bool CurrencyToUsd(string currency,double &rate) {
  if(currency=="USD") { rate=1.0; return true; }
  string direct=currency+"USD",inverse="USD"+currency;
  if(SymbolSelect(direct,true)) { double b=SymbolInfoDouble(direct,SYMBOL_BID); if(b>0){rate=b;return true;} }
  if(SymbolSelect(inverse,true)) { double a=SymbolInfoDouble(inverse,SYMBOL_ASK); if(a>0){rate=1.0/a;return true;} }
  rate=0; return false;
}

double ValuationPrice(string symbol,long type) {
  return type==POSITION_TYPE_BUY ? SymbolInfoDouble(symbol,SYMBOL_BID) : SymbolInfoDouble(symbol,SYMBOL_ASK);
}

bool PositionNotionalUsd(string symbol,long type,double volume,double price,double &usd) {
  double contract=SymbolInfoDouble(symbol,SYMBOL_TRADE_CONTRACT_SIZE);
  string profit_ccy=SymbolInfoString(symbol,SYMBOL_CURRENCY_PROFIT); double fx;
  if(contract<=0 || price<=0 || !CurrencyToUsd(profit_ccy,fx)) return false;
  usd=volume*contract*price*fx; if(type==POSITION_TYPE_SELL) usd=-usd; return true;
}

double EconomicPnlAt(string symbol,double candidate,bool &ok) {
  double sum=0; ok=true;
  for(int i=0;i<PositionsTotal();i++) {
    ulong ticket=PositionGetTicket(i); if(ticket==0 || PositionGetString(POSITION_SYMBOL)!=symbol) continue;
    long pt=PositionGetInteger(POSITION_TYPE); double p=0;
    ENUM_ORDER_TYPE ot=pt==POSITION_TYPE_BUY?ORDER_TYPE_BUY:ORDER_TYPE_SELL;
    if(!OrderCalcProfit(ot,symbol,PositionGetDouble(POSITION_VOLUME),PositionGetDouble(POSITION_PRICE_OPEN),candidate,p)) {ok=false;return 0;}
    sum+=p+PositionGetDouble(POSITION_SWAP);
  }
  return sum;
}

bool BisectPnlRoot(string symbol,double &answer,string &reason) {
  double bid=SymbolInfoDouble(symbol,SYMBOL_BID),point=SymbolInfoDouble(symbol,SYMBOL_POINT);
  if(bid<=0 || point<=0){reason="INSUFFICIENT_DATA";return false;}
  bool ok; double center=EconomicPnlAt(symbol,bid,ok); if(!ok){reason="INSUFFICIENT_DATA";return false;}
  double lo=MathMax(point,bid*0.01),hi=bid*4.0,flo=EconomicPnlAt(symbol,lo,ok),fhi=EconomicPnlAt(symbol,hi,ok);
  if(!ok){reason="INSUFFICIENT_DATA";return false;}
  if(MathAbs(fhi-flo)<0.0000001){reason=MathAbs(center)<0.01?"FLAT_NET_ZERO_PNL":"NO_UNIQUE_BREAK_EVEN";return false;}
  if(flo*fhi>0){reason="NO_UNIQUE_BREAK_EVEN";return false;}
  for(int n=0;n<80;n++){double mid=(lo+hi)/2.0,fm=EconomicPnlAt(symbol,mid,ok);if(!ok)break;if(MathAbs(fm)<0.01){answer=mid;reason="OK_BEFORE_UNKNOWN_CLOSING_COMMISSION";return true;}if(flo*fm<=0){hi=mid;fhi=fm;}else{lo=mid;flo=fm;}}
  answer=(lo+hi)/2.0; reason="OK_BEFORE_UNKNOWN_CLOSING_COMMISSION"; return true;
}

double SymbolNetAt(string symbol,double candidate,bool &ok) {
  double sum=0; ok=true;
  for(int i=0;i<PositionsTotal();i++){ulong t=PositionGetTicket(i);if(t==0||PositionGetString(POSITION_SYMBOL)!=symbol)continue;double u;if(!PositionNotionalUsd(symbol,PositionGetInteger(POSITION_TYPE),PositionGetDouble(POSITION_VOLUME),candidate,u)){ok=false;return 0;}sum+=u;}
  return sum;
}

double LeverageEquation(string symbol,double candidate,double target,bool &ok) {
  double now=SymbolInfoDouble(symbol,SYMBOL_BID); bool a,b; double pnl0=EconomicPnlAt(symbol,now,a),pnl1=EconomicPnlAt(symbol,candidate,b),net=SymbolNetAt(symbol,candidate,ok);
  ok=ok&&a&&b; double equity=AccountInfoDouble(ACCOUNT_EQUITY)+(pnl1-pnl0); if(!ok||equity<=0){ok=false;return 0;} return MathAbs(net)/equity-target;
}

bool SolveFinalPrice(string symbol,double target,double &answer,string &reason) {
  double bid=SymbolInfoDouble(symbol,SYMBOL_BID),point=SymbolInfoDouble(symbol,SYMBOL_POINT); bool ok;
  double net=SymbolNetAt(symbol,bid,ok); if(!ok){reason="USD_CONVERSION_UNAVAILABLE";return false;} if(MathAbs(net)<0.01){reason="NO_FINAL_LEVERAGE_SOLUTION";return false;}
  double lo=MathMax(point,bid*0.01),hi=bid*4.0,flo=LeverageEquation(symbol,lo,target,ok);if(!ok){reason="NON_POSITIVE_EQUITY";return false;}double fhi=LeverageEquation(symbol,hi,target,ok);if(!ok){reason="NON_POSITIVE_EQUITY";return false;}
  if(flo*fhi>0){reason="NO_FINAL_LEVERAGE_SOLUTION";return false;}
  for(int n=0;n<80;n++){double mid=(lo+hi)/2.0,fm=LeverageEquation(symbol,mid,target,ok);if(!ok){reason="NON_POSITIVE_EQUITY";return false;}if(MathAbs(fm)<0.000001){answer=mid;reason="OK";return true;}if(flo*fm<=0){hi=mid;fhi=fm;}else{lo=mid;flo=fm;}}
  answer=(lo+hi)/2.0;reason="OK";return true;
}

bool AnnualSwapRate(string symbol,bool is_long,double notional,double &rate,string &status) {
  long mode=SymbolInfoInteger(symbol,SYMBOL_SWAP_MODE); double raw=SymbolInfoDouble(symbol,is_long?SYMBOL_SWAP_LONG:SYMBOL_SWAP_SHORT);
  if(mode==SYMBOL_SWAP_MODE_DISABLED){rate=0;status="NOT_APPLICABLE";return true;}
  double mult=SymbolInfoDouble(symbol,SYMBOL_SWAP_SUNDAY)+SymbolInfoDouble(symbol,SYMBOL_SWAP_MONDAY)+SymbolInfoDouble(symbol,SYMBOL_SWAP_TUESDAY)+SymbolInfoDouble(symbol,SYMBOL_SWAP_WEDNESDAY)+SymbolInfoDouble(symbol,SYMBOL_SWAP_THURSDAY)+SymbolInfoDouble(symbol,SYMBOL_SWAP_FRIDAY)+SymbolInfoDouble(symbol,SYMBOL_SWAP_SATURDAY);
  if(notional<=0){status="NOT_APPLICABLE";return false;}
  if(mode==SYMBOL_SWAP_MODE_INTEREST_CURRENT || mode==SYMBOL_SWAP_MODE_INTEREST_OPEN){rate=raw;status="OK";return true;}
  double daily=0,fx=1,volume=1.0;
  if(mode==SYMBOL_SWAP_MODE_POINTS){double point=SymbolInfoDouble(symbol,SYMBOL_POINT),tick_size=SymbolInfoDouble(symbol,SYMBOL_TRADE_TICK_SIZE),tick_value=SymbolInfoDouble(symbol,SYMBOL_TRADE_TICK_VALUE);if(tick_size<=0){status="INSUFFICIENT_DATA";return false;}daily=raw*point/tick_size*tick_value*volume;}
  else if(mode==SYMBOL_SWAP_MODE_CURRENCY_SYMBOL){daily=raw*volume;if(!CurrencyToUsd(SymbolInfoString(symbol,SYMBOL_CURRENCY_BASE),fx)){status="USD_CONVERSION_UNAVAILABLE";return false;}daily*=fx;}
  else if(mode==SYMBOL_SWAP_MODE_CURRENCY_MARGIN){daily=raw*volume;if(!CurrencyToUsd(SymbolInfoString(symbol,SYMBOL_CURRENCY_MARGIN),fx)){status="USD_CONVERSION_UNAVAILABLE";return false;}daily*=fx;}
  else if(mode==SYMBOL_SWAP_MODE_CURRENCY_DEPOSIT){daily=raw*volume;if(!CurrencyToUsd(AccountInfoString(ACCOUNT_CURRENCY),fx)){status="USD_CONVERSION_UNAVAILABLE";return false;}daily*=fx;}
  else {status="UNSUPPORTED_SWAP_MODE";return false;}
  rate=(daily*mult*52.0/notional)*100.0;status="OK";return true;
}

void Aggregate() {
  portfolio_net_usd=0;portfolio_gross_usd=0;portfolio_swap_usd=0;account_positions=PositionsTotal();account_longs=0;account_shorts=0;
  string symbols[]; double nets[],longs[],shorts[],swaps[]; int count=0;
  for(int i=0;i<PositionsTotal();i++){ulong t=PositionGetTicket(i);if(t==0)continue;string s=PositionGetString(POSITION_SYMBOL);long pt=PositionGetInteger(POSITION_TYPE);if(pt==POSITION_TYPE_BUY)account_longs++;else account_shorts++;int k=-1;for(int z=0;z<count;z++)if(symbols[z]==s)k=z;if(k<0){k=count++;ArrayResize(symbols,count);ArrayResize(nets,count);ArrayResize(longs,count);ArrayResize(shorts,count);ArrayResize(swaps,count);symbols[k]=s;nets[k]=longs[k]=shorts[k]=swaps[k]=0;}double u;if(PositionNotionalUsd(s,pt,PositionGetDouble(POSITION_VOLUME),ValuationPrice(s,pt),u)){nets[k]+=u;if(u>=0)longs[k]+=u;else shorts[k]+=-u;}swaps[k]+=PositionGetDouble(POSITION_SWAP);}
  for(int k=0;k<count;k++){portfolio_net_usd+=nets[k];portfolio_gross_usd+=MathAbs(nets[k]);double lr,sr;string st;if(AnnualSwapRate(symbols[k],true,longs[k],lr,st))portfolio_swap_usd+=longs[k]*lr/100.0;if(AnnualSwapRate(symbols[k],false,shorts[k],sr,st))portfolio_swap_usd+=shorts[k]*sr/100.0;}
}

void CalculateCurrent() {
  Aggregate(); ZeroMemory(current);current.symbol=_Symbol;current.status="OK";double equity=AccountInfoDouble(ACCOUNT_EQUITY);
  for(int i=0;i<PositionsTotal();i++){ulong t=PositionGetTicket(i);if(t==0||PositionGetString(POSITION_SYMBOL)!=_Symbol)continue;long pt=PositionGetInteger(POSITION_TYPE);current.positions++;if(pt==POSITION_TYPE_BUY)current.long_count++;else current.short_count++;double u;if(PositionNotionalUsd(_Symbol,pt,PositionGetDouble(POSITION_VOLUME),ValuationPrice(_Symbol,pt),u)){current.net_usd+=u;if(u>=0)current.long_usd+=u;else current.short_usd+=-u;}else current.status="USD_CONVERSION_UNAVAILABLE";}
  current.net_leverage=equity>0?MathAbs(current.net_usd)/equity:Unavailable();current.required_deposit=equity>0?MathMax(0,MathAbs(current.net_usd)/MaxLeverage-equity):Unavailable();
  BisectPnlRoot(_Symbol,current.break_even,current.break_even_status);SolveFinalPrice(_Symbol,FinalLeverage,current.final_price,current.final_leverage_status);
  string st1,st2;bool a=AnnualSwapRate(_Symbol,true,current.long_usd,current.long_swap_pct,st1),b=AnnualSwapRate(_Symbol,false,current.short_usd,current.short_swap_pct,st2);current.swap_status=(a||b)?"OK":(st1!="NOT_APPLICABLE"?st1:st2);current.annual_swap_usd=(a?current.long_usd*current.long_swap_pct/100.0:0)+(b?current.short_usd*current.short_swap_pct/100.0:0);
  double minlot=SymbolInfoDouble(_Symbol,SYMBOL_VOLUME_MIN),price=SymbolInfoDouble(_Symbol,SYMBOL_ASK),u;if(PositionNotionalUsd(_Symbol,POSITION_TYPE_BUY,minlot,price,u)&&equity>0)current.next_buy_leverage=MathAbs(current.net_usd+u)/equity;price=SymbolInfoDouble(_Symbol,SYMBOL_BID);if(PositionNotionalUsd(_Symbol,POSITION_TYPE_SELL,minlot,price,u)&&equity>0)current.next_sell_leverage=MathAbs(current.net_usd+u)/equity;
}

void SetLabel(string name,string text,int row,color c=clrNONE) {
  name=PREFIX+name;if(ObjectFind(0,name)<0)ObjectCreate(0,name,OBJ_LABEL,0,0,0);ObjectSetInteger(0,name,OBJPROP_CORNER,CORNER_RIGHT_UPPER);ObjectSetInteger(0,name,OBJPROP_ANCHOR,ANCHOR_RIGHT_UPPER);ObjectSetInteger(0,name,OBJPROP_XDISTANCE,XOffset);ObjectSetInteger(0,name,OBJPROP_YDISTANCE,YOffset+row*LineSpacing);ObjectSetString(0,name,OBJPROP_TEXT,text);ObjectSetString(0,name,OBJPROP_FONT,FontName);ObjectSetInteger(0,name,OBJPROP_FONTSIZE,FontSize);ObjectSetInteger(0,name,OBJPROP_COLOR,c==clrNONE?TextColor:c);ObjectSetInteger(0,name,OBJPROP_SELECTABLE,false);
}
void PriceMarker(string name,double price,string text,color c) {
  name=PREFIX+name;if(price<=0||!MathIsValidNumber(price)){ObjectDelete(0,name);return;}if(ObjectFind(0,name)<0)ObjectCreate(0,name,OBJ_ARROW_RIGHT_PRICE,0,TimeCurrent(),price);ObjectMove(0,name,0,TimeCurrent(),price);ObjectSetString(0,name,OBJPROP_TEXT,text);ObjectSetInteger(0,name,OBJPROP_COLOR,c);ObjectSetInteger(0,name,OBJPROP_SELECTABLE,false);
}
void DrawPanel() {
  double bal=AccountInfoDouble(ACCOUNT_BALANCE),eq=AccountInfoDouble(ACCOUNT_EQUITY),pnl=AccountInfoDouble(ACCOUNT_PROFIT);double dd=bal>0?MathMax(0,(bal-eq)/bal*100):Unavailable();bool ok;double spnl=EconomicPnlAt(_Symbol,SymbolInfoDouble(_Symbol,SYMBOL_BID),ok),sdd=eq>0?MathMax(0,-spnl/eq*100):Unavailable();
  SetLabel("TITLE",EA_NAME+" | "+_Symbol,0,clrLime);SetLabel("ACCOUNT","Balance "+DoubleToString(bal,2)+" | Equity "+DoubleToString(eq,2)+" | P/L "+DoubleToString(pnl,2),1);SetLabel("EXPOSURE","Symbol net $"+DoubleToString(current.net_usd,0)+" | Portfolio net $"+DoubleToString(portfolio_net_usd,0)+" | gross $"+DoubleToString(portfolio_gross_usd,0),2);SetLabel("LEV","Symbol lev "+DoubleToString(current.net_leverage,2)+"x | Gross lev "+DoubleToString(eq>0?portfolio_gross_usd/eq:0,2)+"x",3);SetLabel("PRICES","Break-even "+(current.break_even>0?DoubleToString(current.break_even,_Digits):current.break_even_status)+" | Final "+(current.final_price>0?DoubleToString(current.final_price,_Digits):current.final_leverage_status),4);SetLabel("DD","Account DD "+DoubleToString(dd,2)+"% | Symbol floating DD "+DoubleToString(sdd,2)+"%",5);SetLabel("DEPOSIT","Deposit to "+DoubleToString(MaxLeverage,1)+"x: $"+DoubleToString(current.required_deposit,2),6);SetLabel("SWAP","Swap L "+DoubleToString(current.long_swap_pct,2)+"% | S "+DoubleToString(current.short_swap_pct,2)+"% | run-rate $"+DoubleToString(current.annual_swap_usd,0),7);SetLabel("NEXT","Next min Buy "+DoubleToString(current.next_buy_leverage,2)+"x | Sell "+DoubleToString(current.next_sell_leverage,2)+"x",8);SetLabel("COUNT","T "+IntegerToString(current.positions)+" ("+IntegerToString(account_positions)+") | L "+IntegerToString(current.long_count)+" ("+IntegerToString(account_longs)+") | S "+IntegerToString(current.short_count)+" ("+IntegerToString(account_shorts)+")",9);SetLabel("STATUS","Send: "+send_status,10,send_status=="Success"?clrLime:(StringFind(send_status,"Failed")>=0?clrTomato:TextColor));
  string btn=PREFIX+"SEND";if(ObjectFind(0,btn)<0)ObjectCreate(0,btn,OBJ_BUTTON,0,0,0);ObjectSetInteger(0,btn,OBJPROP_CORNER,CORNER_RIGHT_UPPER);ObjectSetInteger(0,btn,OBJPROP_XDISTANCE,XOffset);ObjectSetInteger(0,btn,OBJPROP_YDISTANCE,YOffset+11*LineSpacing);ObjectSetInteger(0,btn,OBJPROP_XSIZE,170);ObjectSetInteger(0,btn,OBJPROP_YSIZE,24);ObjectSetString(0,btn,OBJPROP_TEXT,"Send to GreenPeak");
  PriceMarker("BE",current.break_even,"Break-even",clrDeepSkyBlue);PriceMarker("FINAL",current.final_price,"Final leverage",clrOrangeRed);ChartRedraw();
}

string PositionJson() {
  string out="[";bool first=true;for(int i=0;i<PositionsTotal();i++){ulong t=PositionGetTicket(i);if(t==0)continue;string s=PositionGetString(POSITION_SYMBOL);long pt=PositionGetInteger(POSITION_TYPE);if(!first)out+=",";first=false;out+="{\"position_identifier\":"+JStr((string)t)+",\"symbol\":"+JStr(s)+",\"direction\":"+JStr(pt==POSITION_TYPE_BUY?"BUY":"SELL")+",\"volume\":"+JNum(PositionGetDouble(POSITION_VOLUME))+",\"contract_size\":"+JNum(SymbolInfoDouble(s,SYMBOL_TRADE_CONTRACT_SIZE))+",\"open_price\":"+JNum(PositionGetDouble(POSITION_PRICE_OPEN))+",\"current_bid\":"+JNum(SymbolInfoDouble(s,SYMBOL_BID))+",\"current_ask\":"+JNum(SymbolInfoDouble(s,SYMBOL_ASK))+",\"current_valuation_price\":"+JNum(ValuationPrice(s,pt))+",\"current_profit_loss\":"+JNum(PositionGetDouble(POSITION_PROFIT))+",\"stop_loss\":"+JNum(PositionGetDouble(POSITION_SL))+",\"take_profit\":"+JNum(PositionGetDouble(POSITION_TP))+",\"accrued_swap\":"+JNum(PositionGetDouble(POSITION_SWAP))+",\"commission\":null,\"magic_number\":"+IntegerToString((int)PositionGetInteger(POSITION_MAGIC))+",\"comment\":"+JStr(PositionGetString(POSITION_COMMENT))+",\"open_time_utc\":"+JStr(Iso((datetime)PositionGetInteger(POSITION_TIME)))+",\"last_update_time_utc\":"+JStr(Iso((datetime)PositionGetInteger(POSITION_TIME_UPDATE)))+"}";}return out+"]";
}
string OrdersJson(){string out="[";bool first=true;for(int i=0;i<OrdersTotal();i++){ulong t=OrderGetTicket(i);if(t==0)continue;if(!first)out+=",";first=false;out+="{\"ticket\":"+JStr((string)t)+",\"symbol\":"+JStr(OrderGetString(ORDER_SYMBOL))+",\"order_type\":"+IntegerToString((int)OrderGetInteger(ORDER_TYPE))+",\"volume\":"+JNum(OrderGetDouble(ORDER_VOLUME_CURRENT))+",\"requested_price\":"+JNum(OrderGetDouble(ORDER_PRICE_OPEN))+",\"stop_loss\":"+JNum(OrderGetDouble(ORDER_SL))+",\"take_profit\":"+JNum(OrderGetDouble(ORDER_TP))+",\"expiration_utc\":"+JStr(Iso((datetime)OrderGetInteger(ORDER_TIME_EXPIRATION)))+",\"magic_number\":"+IntegerToString((int)OrderGetInteger(ORDER_MAGIC))+",\"comment\":"+JStr(OrderGetString(ORDER_COMMENT))+",\"setup_time_utc\":"+JStr(Iso((datetime)OrderGetInteger(ORDER_TIME_SETUP)))+"}";}return out+"]";}
string TradeHistoryJson(){datetime to=TimeCurrent(),from=to-7*86400;string out="[";bool first=true;if(!HistorySelect(from,to))return out+"]";int total=HistoryDealsTotal();for(int i=0;i<total;i++){ulong ticket=HistoryDealGetTicket(i);if(ticket==0)continue;long type=HistoryDealGetInteger(ticket,DEAL_TYPE);if(type!=DEAL_TYPE_BUY&&type!=DEAL_TYPE_SELL)continue;if(!first)out+=",";first=false;out+="{\"deal_identifier\":"+JStr((string)ticket)+",\"order_identifier\":"+JStr((string)HistoryDealGetInteger(ticket,DEAL_ORDER))+",\"position_identifier\":"+JStr((string)HistoryDealGetInteger(ticket,DEAL_POSITION_ID))+",\"timestamp_utc\":"+JStr(Iso((datetime)HistoryDealGetInteger(ticket,DEAL_TIME)))+",\"symbol\":"+JStr(HistoryDealGetString(ticket,DEAL_SYMBOL))+",\"direction\":"+JStr(type==DEAL_TYPE_BUY?"BUY":"SELL")+",\"entry_type\":"+IntegerToString((int)HistoryDealGetInteger(ticket,DEAL_ENTRY))+",\"volume\":"+JNum(HistoryDealGetDouble(ticket,DEAL_VOLUME))+",\"executed_price\":"+JNum(HistoryDealGetDouble(ticket,DEAL_PRICE))+",\"profit\":"+JNum(HistoryDealGetDouble(ticket,DEAL_PROFIT))+",\"commission\":"+JNum(HistoryDealGetDouble(ticket,DEAL_COMMISSION))+",\"swap\":"+JNum(HistoryDealGetDouble(ticket,DEAL_SWAP))+",\"magic_number\":"+IntegerToString((int)HistoryDealGetInteger(ticket,DEAL_MAGIC))+",\"comment\":"+JStr(HistoryDealGetString(ticket,DEAL_COMMENT))+"}";}return out+"]";}
string BrokerJson(){string s=_Symbol;MqlTick tick;SymbolInfoTick(s,tick);return "[{\"symbol\":"+JStr(s)+",\"bid\":"+JNum(tick.bid)+",\"ask\":"+JNum(tick.ask)+",\"spread_points\":"+JNum((tick.ask-tick.bid)/SymbolInfoDouble(s,SYMBOL_POINT))+",\"point\":"+JNum(SymbolInfoDouble(s,SYMBOL_POINT))+",\"tick_size\":"+JNum(SymbolInfoDouble(s,SYMBOL_TRADE_TICK_SIZE))+",\"tick_value\":"+JNum(SymbolInfoDouble(s,SYMBOL_TRADE_TICK_VALUE))+",\"contract_size\":"+JNum(SymbolInfoDouble(s,SYMBOL_TRADE_CONTRACT_SIZE))+",\"minimum_volume\":"+JNum(SymbolInfoDouble(s,SYMBOL_VOLUME_MIN))+",\"volume_step\":"+JNum(SymbolInfoDouble(s,SYMBOL_VOLUME_STEP))+",\"swap_long_raw\":"+JNum(SymbolInfoDouble(s,SYMBOL_SWAP_LONG))+",\"swap_short_raw\":"+JNum(SymbolInfoDouble(s,SYMBOL_SWAP_SHORT))+",\"swap_mode\":"+IntegerToString((int)SymbolInfoInteger(s,SYMBOL_SWAP_MODE))+",\"trade_calculation_mode\":"+IntegerToString((int)SymbolInfoInteger(s,SYMBOL_TRADE_CALC_MODE))+",\"execution_mode\":"+IntegerToString((int)SymbolInfoInteger(s,SYMBOL_TRADE_EXEMODE))+",\"trading_status\":"+IntegerToString((int)SymbolInfoInteger(s,SYMBOL_TRADE_MODE))+",\"quote_timestamp_utc\":"+JStr(Iso(tick.time))+"}]";}

string BuildSnapshot(bool automatic) {
  CalculateCurrent();datetime now=TimeGMT();string id=(string)AccountInfoInteger(ACCOUNT_LOGIN)+"-"+(string)((long)now)+"-"+(string)GetTickCount();double bal=AccountInfoDouble(ACCOUNT_BALANCE),eq=AccountInfoDouble(ACCOUNT_EQUITY);double dd=bal>0?MathMax(0,(bal-eq)/bal*100):Unavailable();
  string j="{\"schema_version\":\"1.0\",\"snapshot_id\":"+JStr(id)+",\"timestamp_utc\":"+JStr(Iso(now))+",\"source\":{\"ea_name\":"+JStr(EA_NAME)+",\"ea_version\":"+JStr(EA_VERSION)+",\"terminal_build\":"+IntegerToString((int)TerminalInfoInteger(TERMINAL_BUILD))+",\"broker_company\":"+JStr(AccountInfoString(ACCOUNT_COMPANY))+",\"trade_server\":"+JStr(AccountInfoString(ACCOUNT_SERVER))+",\"account_identifier\":"+JStr((string)AccountInfoInteger(ACCOUNT_LOGIN))+",\"send_mode\":"+JStr(automatic?"automatic":"manual")+"},";
  j+="\"account\":{\"currency\":"+JStr(AccountInfoString(ACCOUNT_CURRENCY))+",\"balance\":"+JNum(bal)+",\"equity\":"+JNum(eq)+",\"used_margin\":"+JNum(AccountInfoDouble(ACCOUNT_MARGIN))+",\"free_margin\":"+JNum(AccountInfoDouble(ACCOUNT_MARGIN_FREE))+",\"margin_level_pct\":"+JNum(AccountInfoDouble(ACCOUNT_MARGIN_LEVEL))+",\"floating_profit_loss\":"+JNum(AccountInfoDouble(ACCOUNT_PROFIT))+"},";
  j+="\"portfolio_metrics\":{\"net_portfolio_exposure_usd\":"+JNum(portfolio_net_usd)+",\"gross_portfolio_exposure_usd\":"+JNum(portfolio_gross_usd)+",\"net_portfolio_leverage\":"+JNum(eq>0?portfolio_net_usd/eq:Unavailable())+",\"gross_portfolio_leverage\":"+JNum(eq>0?portfolio_gross_usd/eq:Unavailable())+",\"account_current_drawdown_pct\":"+JNum(dd)+",\"required_deposit_for_gross_portfolio_usd\":"+JNum(eq>0?MathMax(0,portfolio_gross_usd/MaxLeverage-eq):Unavailable())+"},";
  j+="\"symbol_metrics\":[{\"symbol\":"+JStr(_Symbol)+",\"net_symbol_exposure_usd\":"+JNum(current.net_usd)+",\"long_symbol_notional_usd\":"+JNum(current.long_usd)+",\"short_symbol_notional_usd\":"+JNum(current.short_usd)+",\"net_symbol_leverage\":"+JNum(current.net_leverage)+",\"break_even_price\":"+JNum(current.break_even)+",\"break_even_status\":"+JStr(current.break_even_status)+",\"final_leverage_price\":"+JNum(current.final_price)+",\"final_leverage_status\":"+JStr(current.final_leverage_status)+",\"required_deposit_for_active_symbol_usd\":"+JNum(current.required_deposit)+",\"annualized_long_swap_rate_pct\":"+JNum(current.long_swap_pct)+",\"annualized_short_swap_rate_pct\":"+JNum(current.short_swap_pct)+",\"current_symbol_annualized_swap_cost_usd\":"+JNum(current.annual_swap_usd)+",\"next_buy_net_symbol_leverage\":"+JNum(current.next_buy_leverage)+",\"next_sell_net_symbol_leverage\":"+JNum(current.next_sell_leverage)+"}],";
  j+="\"positions\":"+PositionJson()+",\"pending_orders\":"+OrdersJson()+",\"broker_symbol_data\":"+BrokerJson()+",\"swap_metrics\":{\"portfolio_annualized_swap_cost_usd\":"+JNum(portfolio_swap_usd)+",\"portfolio_annual_swap_burden_pct_equity\":"+JNum(eq>0?portfolio_swap_usd/eq*100:Unavailable())+"},\"trade_history_delta\":"+TradeHistoryJson()+",\"calculation_status\":{\"active_symbol\":"+JStr(current.status)+",\"swap\":"+JStr(current.swap_status)+",\"trade_history_window_days\":7,\"commission_convention\":\"EXCLUDES_UNKNOWN_FUTURE_CLOSING_COMMISSION\"}}";return j;
}

bool SendSnapshot(bool automatic) {
  if(StringFind(GreenPeakApiUrl,"https://")!=0 || GreenPeakApiToken==""){send_status="Failed: configuration";return false;}string json=BuildSnapshot(automatic),headers="Content-Type: application/json\r\nAuthorization: Bearer "+GreenPeakApiToken+"\r\n";char data[],response[];string response_headers;StringToCharArray(json,data,0,WHOLE_ARRAY,CP_UTF8);if(ArraySize(data)>0)ArrayResize(data,ArraySize(data)-1);ResetLastError();int code=WebRequest("POST",GreenPeakApiUrl,headers,15000,data,response,response_headers);if(code>=200&&code<300){send_status="Success";last_send=TimeCurrent();Print(EA_NAME," send succeeded HTTP ",code);return true;}send_status="Failed HTTP "+IntegerToString(code);Print(EA_NAME," send failed HTTP ",code," error ",GetLastError());return false;
}

int OnInit(){if(FinalLeverage<=0||MaxLeverage<=0||LocalRefreshSeconds<1||AutoSendIntervalSeconds<1){Print(EA_NAME," invalid inputs");return INIT_PARAMETERS_INCORRECT;}EventSetTimer(LocalRefreshSeconds);CalculateCurrent();DrawPanel();Print(EA_NAME," initialized schema ",SCHEMA_VERSION," version ",EA_VERSION);return INIT_SUCCEEDED;}
void OnTimer(){CalculateCurrent();DrawPanel();if(AutoSendEnabled&&(last_send==0||TimeCurrent()-last_send>=AutoSendIntervalSeconds))SendSnapshot(true);}
void OnChartEvent(const int id,const long &l,const double &d,const string &s){if(id==CHARTEVENT_OBJECT_CLICK&&s==PREFIX+"SEND"){send_status="Sending...";DrawPanel();SendSnapshot(false);DrawPanel();}}
void OnDeinit(const int reason){EventKillTimer();ObjectsDeleteAll(0,PREFIX);ChartRedraw();Print(EA_NAME," deinitialized reason ",reason);}
