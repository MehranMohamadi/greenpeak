# Broker comparison account types

Comparison columns are grouped by normalized broker company **and account type**.
Real, demo, contest and unknown accounts have distinct `broker_key` values and
never contribute to each other's spread, swap, commission, dividend or sample
statistics. Existing median formulas and currency selection are unchanged.
`eligible_broker_count` counts comparison columns, including separate types of
the same company. Columns for one company stay adjacent, ordered real, demo,
contest, unknown. Raw snapshots and existing account identities are not rewritten.

The additive response field `brokers[].account_type` is `real`, `demo`, `contest`
or `unknown`; it is visible to authenticated viewers alongside the broker name.
Existing user/account identifier redaction and admin-only sample counts remain.
Older responses without this field display an unknown-type label.

The preferred input is `account.trade_mode`, followed by `account.account_type`.
Recognized values are the explicit MT5 enum names, real/demo/contest labels,
or integer enum values (0 demo, 1 contest, 2 real). An invalid explicitly provided
mode stays unknown; it is never overridden using the server name.

For snapshots from older experts without a mode field, only an unambiguous
demo/real/live/contest server-name token (optionally numbered) is used. An absent
or conflicting marker stays unknown, separate from known real/demo data. Missing
`Demo` in a server name is **not** evidence of a real account.

The expert source version 1.04 sends `account.trade_mode` using
`EnumToString((ENUM_ACCOUNT_TRADE_MODE)AccountInfoInteger(ACCOUNT_TRADE_MODE))`.
The existing additive snapshot schema 1.0 preserves this field. Compile/install
the updated expert and submit a fresh snapshot for authoritative classification
when an older server name does not identify the type. Existing installed experts
are not remotely modified.

References: [MQL5 account properties](https://www.mql5.com/en/docs/constants/environment_state/accountinformation),
[MetaEditor compilation](https://www.metatrader5.com/en/metaeditor/help/beginning/integration_ide).
