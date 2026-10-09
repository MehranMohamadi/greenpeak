export const MT5_BROKER_DELETED_EVENT = "greenpeak:mt5-broker-deleted"

export function withoutBroker(snapshots, brokerCompany) {
  return snapshots.filter((snapshot) => snapshot.source?.broker_company !== brokerCompany)
}

export function clearBrokerRiskStorage(storage, accounts) {
  const keys = new Set(accounts.map((source) => [
    source.broker_company, source.trade_server, source.account_identifier,
  ].filter(Boolean).join("::")))
  for (const key of keys) {
    for (const prefix of ["greenpeak:risk-rules:", "greenpeak:trade-draft:", "greenpeak:risk-plans:"]) {
      storage.removeItem(`${prefix}${key}`)
    }
  }
}

export function notifyBrokerDeleted(result, knownSnapshots = []) {
  const accounts = [
    ...(result.deleted_accounts || []),
    ...knownSnapshots.filter((snapshot) => snapshot.source?.broker_company === result.broker_company).map((snapshot) => snapshot.source),
  ]
  try { clearBrokerRiskStorage(window.localStorage, accounts) } catch { /* Browser storage may be disabled. */ }
  window.dispatchEvent(new CustomEvent(MT5_BROKER_DELETED_EVENT, { detail: result }))
  window.dispatchEvent(new CustomEvent("greenpeak:risk-rules-updated"))
}
