'use client'
import { useMemo, useState } from 'react'

/**
 * Veil — Payments (bank-statement view)
 *
 * Drop this in wherever the current "Payments" panel lives in the agent
 * dashboard (it renders just the panel content — the sidebar/header in the
 * screenshot are assumed to already exist around it).
 *
 * TODO(backend): replace `MOCK_PAYMENTS` with a real fetch, e.g.
 *   const payments = await fetch('/api/payments').then(r => r.json())
 * Shape each record to match the `Payment` type below — it already lines up
 * with the x402 payment + capability fields mentioned in the project notes
 * (payer/payee, capability start/expiry, tx hash).
 */

type PaymentStatus = 'completed' | 'pending' | 'failed'

type Payment = {
  id: string
  timestamp: string // ISO — when the payment was made
  resourceName: string // what was bought, e.g. "/api/premium-data"
  description: string // short human label for the resource
  amount: number
  currency: 'USDC' | 'ALGO'
  status: PaymentStatus
  startsAt: string // ISO — capability validity start
  expiresAt: string // ISO — capability validity end
  txHash: string
  payerAddress: string
  payeeAddress: string
  capabilityId: string
}

// TODO(backend): remove — for layout/demo purposes only.
const MOCK_PAYMENTS: Payment[] = [
  {
    id: 'pay_0001',
    timestamp: '2026-08-22T09:14:00Z',
    resourceName: '/api/premium-data',
    description: 'Market data feed — 1hr access',
    amount: 0.05,
    currency: 'USDC',
    status: 'completed',
    startsAt: '2026-08-22T09:14:00Z',
    expiresAt: '2026-08-22T10:14:00Z',
    txHash: 'TXABC123DEF456GHI789JKL012MNO345PQR678STU901VWX234',
    payerAddress: 'BR6NL6ZZ3G4X2QF7K5V8YJ1H0M9N3P2Q5R7S9T1U3V5W7X9YKM3OYY',
    payeeAddress: 'VEILAGENTCAPABILITYCONTRACTADDR7X9YKM3OYYZZ1122334',
    capabilityId: 'cap_7f3a91',
  },
  {
    id: 'pay_0002',
    timestamp: '2026-08-21T18:02:00Z',
    resourceName: '/api/premium-data',
    description: 'Market data feed — 1hr access',
    amount: 0.05,
    currency: 'USDC',
    status: 'completed',
    startsAt: '2026-08-21T18:02:00Z',
    expiresAt: '2026-08-21T19:02:00Z',
    txHash: 'TX9182HIJ345KLM678NOP901QRS234TUV567WXY890ZAB123CD',
    payerAddress: 'BR6NL6ZZ3G4X2QF7K5V8YJ1H0M9N3P2Q5R7S9T1U3V5W7X9YKM3OYY',
    payeeAddress: 'VEILAGENTCAPABILITYCONTRACTADDR7X9YKM3OYYZZ1122334',
    capabilityId: 'cap_5b1c02',
  },
  {
    id: 'pay_0003',
    timestamp: '2026-08-21T12:47:00Z',
    resourceName: '/api/premium-data',
    description: 'Market data feed — 1hr access',
    amount: 0.05,
    currency: 'USDC',
    status: 'failed',
    startsAt: '2026-08-21T12:47:00Z',
    expiresAt: '2026-08-21T12:47:00Z',
    txHash: 'TX0000000000000000000000000000000000000000000000',
    payerAddress: 'BR6NL6ZZ3G4X2QF7K5V8YJ1H0M9N3P2Q5R7S9T1U3V5W7X9YKM3OYY',
    payeeAddress: 'VEILAGENTCAPABILITYCONTRACTADDR7X9YKM3OYYZZ1122334',
    capabilityId: 'cap_a90fe1',
  },
]

function shorten(addr: string) {
  if (addr.length <= 14) return addr
  return `${addr.slice(0, 6)}...${addr.slice(-6)}`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDateTime(iso: string) {
  return `${formatDate(iso)}, ${formatTime(iso)}`
}

function formatAmount(amount: number, currency: string) {
  return `${amount.toFixed(currency === 'ALGO' ? 3 : 2)} ${currency}`
}

const STATUS_LABEL: Record<PaymentStatus, string> = {
  completed: 'Completed',
  pending: 'Pending',
  failed: 'Failed',
}

function buildReceiptHTML(payment: Payment): string {
  const rows: Array<[string, string]> = [
    ['Transaction ID', payment.id],
    ['Capability ID', payment.capabilityId],
    ['Date', formatDateTime(payment.timestamp)],
    ['Resource', `${payment.description} (${payment.resourceName})`],
    ['Amount', formatAmount(payment.amount, payment.currency)],
    ['Status', STATUS_LABEL[payment.status]],
    ['Access starts', formatDateTime(payment.startsAt)],
    ['Access expires', formatDateTime(payment.expiresAt)],
    ['Payer address', payment.payerAddress],
    ['Payee address', payment.payeeAddress],
    ['Transaction hash', payment.txHash],
  ]

  const rowsHtml = rows
    .map(
      ([label, value]) => `
        <tr>
          <td class="label">${label}</td>
          <td class="value">${value}</td>
        </tr>`
    )
    .join('')

  // TODO(backend): link txHash to the real Algorand TestNet explorer once
  // the facilitator/network base URL is finalized.
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Veil receipt — ${payment.id}</title>
<style>
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    color: #1a1a1a;
    padding: 48px;
    max-width: 640px;
    margin: 0 auto;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 700;
    font-size: 20px;
    margin-bottom: 4px;
  }
  .brand__mark {
    width: 0; height: 0;
    border-top: 7px solid transparent;
    border-bottom: 7px solid transparent;
    border-left: 11px solid #E4142F;
  }
  .eyebrow {
    font-size: 11px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #E4142F;
    font-weight: 700;
    margin-bottom: 28px;
  }
  h1 { font-size: 16px; margin: 0 0 24px; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 10px 0; font-size: 13px; border-bottom: 1px solid #eee; }
  td.label { color: #666; width: 40%; }
  td.value { text-align: right; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; word-break: break-all; }
  .footer { margin-top: 32px; font-size: 11px; color: #888; line-height: 1.6; }
  @media print {
    body { padding: 24px; }
  }
</style>
</head>
<body>
  <div class="brand"><span class="brand__mark"></span>Veil</div>
  <div class="eyebrow">Payment receipt</div>
  <h1>Receipt for ${payment.description}</h1>
  <table>${rowsHtml}</table>
  <div class="footer">
    Generated by Veil's economic capability layer. This receipt reflects an
    on-chain payment recorded on Algorand TestNet — the transaction hash
    above can be independently verified on a TestNet explorer.
  </div>
</body>
</html>`
}

function downloadBillAsPDF(payment: Payment) {
  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'
  iframe.style.right = '0'
  iframe.style.bottom = '0'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = '0'
  document.body.appendChild(iframe)

  const doc = iframe.contentWindow?.document
  if (!doc) {
    document.body.removeChild(iframe)
    return
  }
  doc.open()
  doc.write(buildReceiptHTML(payment))
  doc.close()

  setTimeout(() => {
    iframe.contentWindow?.focus()
    iframe.contentWindow?.print()
    setTimeout(() => document.body.removeChild(iframe), 1000)
  }, 250)
}

export default function PaymentsPanel() {
  // TODO(backend): swap MOCK_PAYMENTS for fetched data.
  const [payments] = useState<Payment[]>(MOCK_PAYMENTS)
  const [selected, setSelected] = useState<Payment | null>(null)

  const summary = useMemo(() => {
    const completed = payments.filter((p) => p.status === 'completed')
    const total = completed.reduce((sum, p) => sum + p.amount, 0)
    const currency = completed[0]?.currency ?? 'USDC'
    return { total, currency, count: payments.length }
  }, [payments])

  if (payments.length === 0) {
    return (
      <div className="panel">
        <PanelBaseStyles />
        <h2 className="panel__title">Payments</h2>
        <p className="empty">No payments yet.</p>
      </div>
    )
  }

  return (
    <div className="panel">
      <PanelBaseStyles />
      <div className="panel__head">
        <h2 className="panel__title">Payments</h2>
        <div className="summary">
          <span className="summary__amount">{formatAmount(summary.total, summary.currency)}</span>
          <span className="summary__label">spent · {summary.count} transactions</span>
        </div>
      </div>

      <div className="statement">
        <div className="statement__row statement__row--head">
          <span>Date</span>
          <span>Description</span>
          <span>Valid until</span>
          <span className="align-right">Amount</span>
          <span>Status</span>
          <span />
        </div>
        {payments.map((p) => (
          <div key={p.id} className="statement__row" onClick={() => setSelected(p)}>
            <span className="cell__date">
              {formatDate(p.timestamp)}
              <span className="cell__time">{formatTime(p.timestamp)}</span>
            </span>
            <span className="cell__desc">
              {p.description}
              <span className="cell__resource">{p.resourceName}</span>
            </span>
            <span className="cell__expiry">{formatDateTime(p.expiresAt)}</span>
            <span className="align-right cell__amount">{formatAmount(p.amount, p.currency)}</span>
            <span>
              <span className={`badge badge--${p.status}`}>{STATUS_LABEL[p.status]}</span>
            </span>
            <button
              className="cell__download"
              onClick={(e) => {
                e.stopPropagation()
                downloadBillAsPDF(p)
              }}
              aria-label="Download bill as PDF"
              title="Download bill"
            >
              ⭳
            </button>
          </div>
        ))}
      </div>

      {selected && (
        <div className="overlay" onClick={() => setSelected(null)}>
          <div className="bill" onClick={(e) => e.stopPropagation()}>
            <div className="bill__head">
              <div>
                <div className="bill__eyebrow">Payment receipt</div>
                <h3>{selected.description}</h3>
              </div>
              <button className="bill__close" onClick={() => setSelected(null)} aria-label="Close">
                ✕
              </button>
            </div>

            <dl className="bill__rows">
              <div>
                <dt>Transaction ID</dt>
                <dd>{selected.id}</dd>
              </div>
              <div>
                <dt>Capability ID</dt>
                <dd>{selected.capabilityId}</dd>
              </div>
              <div>
                <dt>Date</dt>
                <dd>{formatDateTime(selected.timestamp)}</dd>
              </div>
              <div>
                <dt>Resource</dt>
                <dd>{selected.resourceName}</dd>
              </div>
              <div>
                <dt>Amount</dt>
                <dd>{formatAmount(selected.amount, selected.currency)}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>
                  <span className={`badge badge--${selected.status}`}>{STATUS_LABEL[selected.status]}</span>
                </dd>
              </div>
              <div>
                <dt>Access starts</dt>
                <dd>{formatDateTime(selected.startsAt)}</dd>
              </div>
              <div>
                <dt>Access expires</dt>
                <dd>{formatDateTime(selected.expiresAt)}</dd>
              </div>
              <div>
                <dt>Payer</dt>
                <dd className="mono">{shorten(selected.payerAddress)}</dd>
              </div>
              <div>
                <dt>Payee</dt>
                <dd className="mono">{shorten(selected.payeeAddress)}</dd>
              </div>
              <div>
                <dt>Tx hash</dt>
                <dd className="mono">{shorten(selected.txHash)}</dd>
              </div>
            </dl>

            <button className="bill__download" onClick={() => downloadBillAsPDF(selected)}>
              Download bill (PDF)
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        .panel__head {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          margin-bottom: 18px;
        }
        .summary {
          text-align: right;
        }
        .summary__amount {
          display: block;
          font-size: 16px;
          font-weight: 700;
          color: var(--text);
        }
        .summary__label {
          display: block;
          font-size: 11.5px;
          color: var(--text);
          opacity: 0.55;
        }

        .statement {
          border: 1px solid var(--border);
          border-radius: 12px;
          overflow: hidden;
        }
        .statement__row {
          display: grid;
          grid-template-columns: 100px 1.6fr 160px 110px 100px 32px;
          gap: 12px;
          align-items: center;
          padding: 13px 16px;
          border-bottom: 1px solid var(--border);
          cursor: pointer;
          transition: background 0.12s ease;
        }
        .statement__row:last-child {
          border-bottom: none;
        }
        .statement__row:not(.statement__row--head):hover {
          background: color-mix(in srgb, var(--accent) 5%, transparent);
        }
        .statement__row--head {
          cursor: default;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: var(--text);
          opacity: 0.45;
          font-weight: 600;
        }
        .statement__row--head:hover {
          background: none;
        }
        .align-right {
          text-align: right;
        }
        .cell__date {
          display: flex;
          flex-direction: column;
          font-size: 13px;
          color: var(--text);
        }
        .cell__time {
          font-size: 11px;
          opacity: 0.5;
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        }
        .cell__desc {
          display: flex;
          flex-direction: column;
          font-size: 13px;
          color: var(--text);
          min-width: 0;
        }
        .cell__resource {
          font-size: 11px;
          opacity: 0.5;
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .cell__expiry {
          font-size: 12.5px;
          color: var(--text);
          opacity: 0.7;
        }
        .cell__amount {
          font-size: 13px;
          font-weight: 600;
          color: var(--text);
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        }
        .cell__download {
          border: 1px solid var(--border);
          background: none;
          border-radius: 6px;
          width: 26px;
          height: 26px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: var(--text);
          opacity: 0.55;
          font-size: 13px;
        }
        .cell__download:hover {
          opacity: 1;
          border-color: var(--accent);
          color: var(--accent);
        }

        .badge {
          display: inline-block;
          font-size: 11px;
          font-weight: 600;
          padding: 3px 8px;
          border-radius: 999px;
        }
        .badge--completed {
          background: color-mix(in srgb, #1fae5c 15%, transparent);
          color: #1fae5c;
        }
        .badge--pending {
          background: color-mix(in srgb, #d9a441 15%, transparent);
          color: #b8842a;
        }
        .badge--failed {
          background: color-mix(in srgb, var(--accent) 12%, transparent);
          color: var(--accent);
        }

        .overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.45);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          z-index: 50;
        }
        .bill {
          width: 100%;
          max-width: 420px;
          background: var(--bg);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 22px;
          max-height: 86vh;
          overflow-y: auto;
        }
        .bill__head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
        }
        .bill__eyebrow {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--accent);
          font-weight: 700;
        }
        .bill__head h3 {
          margin: 4px 0 0;
          font-size: 16px;
          color: var(--text);
        }
        .bill__close {
          border: none;
          background: none;
          color: var(--text);
          opacity: 0.5;
          cursor: pointer;
          font-size: 14px;
        }
        .bill__close:hover {
          opacity: 1;
        }
        .bill__rows {
          margin: 20px 0 0;
        }
        .bill__rows > div {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 12px;
          padding: 9px 0;
          border-bottom: 1px solid var(--border);
        }
        .bill__rows > div:last-child {
          border-bottom: none;
        }
        .bill__rows dt {
          font-size: 12px;
          color: var(--text);
          opacity: 0.55;
          flex-shrink: 0;
        }
        .bill__rows dd {
          margin: 0;
          font-size: 12.5px;
          color: var(--text);
          text-align: right;
        }
        .bill__rows dd.mono {
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          font-size: 11.5px;
          word-break: break-all;
        }
        .bill__download {
          width: 100%;
          margin-top: 20px;
          background: var(--accent);
          color: #fff;
          border: none;
          border-radius: 10px;
          padding: 11px 16px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
        }
        .bill__download:hover {
          opacity: 0.9;
        }

        @media (max-width: 640px) {
          .statement__row {
            grid-template-columns: 1fr;
            gap: 4px;
          }
          .statement__row--head {
            display: none;
          }
          .cell__expiry {
            order: 3;
          }
        }
      `}</style>
    </div>
  )
}

function PanelBaseStyles() {
  return (
    <style jsx global>{`
      .panel {
        border: 1px solid var(--border);
        border-radius: 14px;
        background: var(--bg);
        padding: 22px;
      }
      .panel__title {
        font-size: 15px;
        font-weight: 700;
        color: var(--text);
        margin: 0 0 4px;
      }
      .empty {
        font-size: 13.5px;
        color: var(--text);
        opacity: 0.55;
        margin: 8px 0 0;
      }
    `}</style>
  )
}
