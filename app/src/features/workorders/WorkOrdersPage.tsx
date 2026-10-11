import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Cable, CheckCircle2, Link2, Plug, RefreshCw, Send, ShieldCheck, Webhook, XCircle } from 'lucide-react';
import { Btn, Card, Chip, Kpi, PageHeader, Tabs, Td, Th, type Tone } from '../../design/ui';
import { useApp } from '../../app/store';
import { API_URL } from '../../lib/api';
import { WorkOrderBoard } from '../assets/WorkOrderBoard';
import { useWorkOrders } from '../assets/woStore';
import { useIntegration, type Integration, type Ticket } from './integrationStore';
import { PrioChip, relTime, slaText, StatusChip } from './parts';

type Tab = 'board' | 'tickets' | 'integrations';

const KIND_LABEL: Record<Integration['kind'], { en: string; ar: string }> = {
  ticketing: { en: 'Ticketing / ITSM', ar: 'التذاكر / ITSM' },
  cmms: { en: 'CMMS / EAM', ar: 'إدارة الصيانة' },
  erp: { en: 'ERP', ar: 'تخطيط الموارد' },
  chat: { en: 'Notifications', ar: 'الإشعارات' },
};

export default function WorkOrdersPage() {
  const lang = useApp((s) => s.lang);
  const L = (en: string, ar: string) => (lang === 'ar' ? ar : en);
  const [sp] = useSearchParams();
  const [tab, setTab] = useState<Tab>(sp.get('wo') ? 'tickets' : sp.get('tab') === 'integrations' ? 'integrations' : 'board');
  const wos = useWorkOrders((s) => s.list);
  const { tickets, integrations, online, init } = useIntegration();
  useEffect(() => {
    void init();
  }, [init]);

  const open = wos.filter((w) => w.status !== 'done').length;
  const inProg = tickets.filter((t) => t.status === 'in_progress').length;
  const breached = tickets.filter((t) => t.sla.breached && t.status !== 'resolved').length;
  const connected = integrations.filter((i) => i.status === 'connected').length;

  return (
    <div className="h-full flex flex-col min-h-0" data-testid="workorders-page">
      <PageHeader
        title={L('Work Orders', 'أوامر العمل')}
        subtitle={L('Every department\'s work in one place - synced with your ticketing tools', 'عمل كل الإدارات في مكان واحد - متزامن مع أدوات التذاكر لديكم')}
        actions={
          <Chip tone={online ? 'good' : online === false ? 'neutral' : 'info'} dot>
            {online ? L('Integration hub online', 'مركز التكامل متصل') : online === false ? L('Local mode', 'وضع محلي') : L('Connecting...', 'جارٍ الاتصال...')}
          </Chip>
        }
      />
      <div className="px-5 pb-1 grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Kpi label={L('Open work orders', 'أوامر العمل المفتوحة')} value={open} hint={`${wos.length} ${L('total', 'الإجمالي')}`} tone="info" />
        <Kpi label={L('Tickets in progress', 'تذاكر قيد التنفيذ')} value={inProg} hint={`${tickets.length} ${L('synced to tools', 'متزامنة مع الأدوات')}`} tone="neutral" />
        <Kpi label={L('SLA breached', 'تجاوز اتفاقية الخدمة')} value={breached} tone={breached > 0 ? 'warn' : 'good'} hint={L('open tickets past due', 'تذاكر مفتوحة متأخرة')} />
        <Kpi label={L('Tools connected', 'الأدوات المتصلة')} value={`${connected}/${integrations.length || 5}`} tone={connected === integrations.length ? 'good' : 'warn'} hint={L('ServiceNow, Jira, Maximo...', 'ServiceNow وJira وMaximo...')} />
      </div>
      <div className="px-5 pt-2">
        <Tabs<Tab>
          value={tab}
          onChange={setTab}
          tabs={[
            { id: 'board', label: L('Work order board', 'لوحة أوامر العمل') },
            { id: 'tickets', label: `${L('Tickets in your tools', 'التذاكر في أدواتكم')} (${tickets.length})` },
            { id: 'integrations', label: L('Integrations', 'التكامل') },
          ]}
        />
      </div>
      <div className="flex-1 min-h-0 overflow-auto px-5 py-3">
        {tab === 'board' && <WorkOrderBoard />}
        {tab === 'tickets' && <TicketsTab highlight={sp.get('wo')} />}
        {tab === 'integrations' && <IntegrationsTab />}
      </div>
    </div>
  );
}

function TicketsTab({ highlight }: { highlight: string | null }) {
  const lang = useApp((s) => s.lang);
  const L = (en: string, ar: string) => (lang === 'ar' ? ar : en);
  const tickets = useIntegration((s) => s.tickets);
  const integrations = useIntegration((s) => s.integrations);
  const [openId, setOpenId] = useState<string | null>(null);
  const hl = tickets.find((t) => t.woId === highlight)?.id ?? null;
  useEffect(() => {
    if (hl) setOpenId(hl);
  }, [hl]);
  const sysName = (id: string) => integrations.find((i) => i.id === id)?.name ?? id;
  return (
    <Card title={L('Tickets synced with external tools', 'التذاكر المتزامنة مع الأدوات الخارجية')} subtitle={L('Status changes in the other tool appear here live', 'تظهر هنا مباشرة تغييرات الحالة في الأداة الأخرى')} bodyClass="!px-0 overflow-auto">
      <table className="w-full border-collapse" data-testid="ticket-table">
        <thead>
          <tr>
            <Th>{L('Ticket', 'التذكرة')}</Th>
            <Th>{L('Work order', 'أمر العمل')}</Th>
            <Th>{L('Title', 'العنوان')}</Th>
            <Th>{L('Department', 'الإدارة')}</Th>
            <Th>{L('Tool / reference', 'الأداة / المرجع')}</Th>
            <Th>{L('Priority', 'الأولوية')}</Th>
            <Th>{L('Status', 'الحالة')}</Th>
            <Th>{L('Assignee', 'المسؤول')}</Th>
            <Th align="end">{L('Updated', 'التحديث')}</Th>
          </tr>
        </thead>
        <tbody>
          {tickets.length === 0 && (
            <tr>
              <Td className="text-dim" title="">{L('No tickets yet. Raise one from an alert or the Digital Twin.', 'لا توجد تذاكر بعد. أنشئ واحدة من تنبيه أو من التوأم الرقمي.')}</Td>
            </tr>
          )}
          {tickets.map((t) => (
            <TicketRows key={t.id} t={t} open={openId === t.id} hl={hl === t.id} onToggle={() => setOpenId(openId === t.id ? null : t.id)} sys={sysName(t.system)} />
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function TicketRows({ t, open, hl, onToggle, sys }: { t: Ticket; open: boolean; hl: boolean; onToggle: () => void; sys: string }) {
  const lang = useApp((s) => s.lang);
  const L = (en: string, ar: string) => (lang === 'ar' ? ar : en);
  return (
    <>
      <tr className="cursor-pointer hover:bg-surface-2" style={hl ? { background: 'color-mix(in srgb, var(--violet) 10%, transparent)' } : undefined} onClick={onToggle} data-testid={`ticket-${t.woId ?? t.id}`}>
        <Td className="tabular-nums font-medium whitespace-nowrap">{t.id}</Td>
        <Td className="tabular-nums whitespace-nowrap">{t.woId ?? '-'}</Td>
        <Td className="max-w-[320px]"><span className="block truncate" title={t.title}>{t.title}</span></Td>
        <Td className="whitespace-nowrap">{t.department}</Td>
        <Td className="whitespace-nowrap"><span className="text-[12px]">{sys}</span> <Chip tone="neutral">{t.externalRef}</Chip></Td>
        <Td><PrioChip priority={t.priority} /></Td>
        <Td><StatusChip status={t.status} /></Td>
        <Td className="whitespace-nowrap">{t.assignee}</Td>
        <Td align="end" className="whitespace-nowrap text-dim">{relTime(t.updatedAt, lang)}</Td>
      </tr>
      {open && (
        <tr>
          <Td className="!p-0" title="">
            <span />
          </Td>
          <td colSpan={8} className="px-3 py-2.5 bg-surface-2 border-b border-line">
            <div className="flex flex-wrap gap-6">
              <div className="min-w-[240px] flex-1">
                <div className="text-[11px] uppercase tracking-wider text-dim mb-1">{L('Timeline', 'الخط الزمني')}</div>
                <ol className="m-0 ps-0 list-none space-y-1">
                  {t.timeline.map((e, i) => (
                    <li key={i} className="flex gap-2 text-[12px]">
                      <span className="mt-[5px] size-1.5 rounded-full shrink-0" style={{ background: 'var(--violet)' }} />
                      <span><b>{e.status.replace('_', ' ')}</b> - {e.note} <span className="text-dim">({relTime(e.at, lang)})</span></span>
                    </li>
                  ))}
                </ol>
              </div>
              <div className="text-[12px] space-y-0.5 min-w-[200px]">
                <div><span className="text-dim">{L('Asset / ref', 'الأصل / المرجع')}:</span> {t.assetId ?? '-'}</div>
                <div><span className="text-dim">{L('Source', 'المصدر')}:</span> {t.source}</div>
                <div><span className="text-dim">SLA:</span> {slaText(t.sla.dueAt, lang)} {t.sla.breached && <Chip tone="bad">{L('breached', 'متجاوز')}</Chip>}</div>
                {t.description && <div className="text-muted max-w-[420px]">{t.description}</div>}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

const INT_TONE: Record<Integration['status'], Tone> = { connected: 'good', disconnected: 'neutral', error: 'bad' };

function IntegrationsTab() {
  const lang = useApp((s) => s.lang);
  const L = (en: string, ar: string) => (lang === 'ar' ? ar : en);
  const { integrations, tickets, logs, online, wsLive, test, setConnected, sync } = useIntegration();
  const [testing, setTesting] = useState<Record<string, string>>({});
  const departments = useMemo(() => {
    const m = new Map<string, Integration[]>();
    for (const i of integrations) for (const d of i.departments) m.set(d, [...(m.get(d) ?? []), i]);
    return [...m.entries()];
  }, [integrations]);
  const runTest = async (id: string) => {
    setTesting((s) => ({ ...s, [id]: '...' }));
    const r = await test(id);
    setTesting((s) => ({ ...s, [id]: r.ok ? `OK ${r.latencyMs} ms` : r.message }));
  };
  const base = API_URL || (typeof location !== 'undefined' ? location.origin : '');
  return (
    <div className="space-y-3" data-testid="integrations-tab">
      <Card title={L('How your departments connect their ticketing tools', 'كيف تربط الإدارات أدوات التذاكر لديها')} subtitle={L('Each department keeps its own tool. Work orders raised here are pushed to it, and status flows back to this dashboard.', 'تحتفظ كل إدارة بأداتها. تُدفع أوامر العمل إليها وتعود الحالة إلى هذه اللوحة.')}>
        <div className="grid gap-3 md:grid-cols-4 text-[12.5px]">
          {[
            { icon: <Plug size={16} />, t: L('1. Connect', '1. الربط'), d: L('Pick the tool, add its endpoint and credentials (held by the hub, never in the browser).', 'اختر الأداة وأضف عنوانها وبيانات الدخول (تحفظها المنصة لا المتصفح).') },
            { icon: <Link2 size={16} />, t: L('2. Map departments', '2. ربط الإدارات'), d: L('Map each department to its tool: HSE to Jira, Plant to Maximo, Procurement to SAP, the rest to ServiceNow.', 'اربط كل إدارة بأداتها: السلامة بـ Jira والمعدات بـ Maximo والمشتريات بـ SAP والباقي بـ ServiceNow.') },
            { icon: <Send size={16} />, t: L('3. Push', '3. الدفع'), d: L('A work order or AI alert becomes a ticket in the right tool with priority, SLA and owner.', 'يتحول أمر العمل أو تنبيه الذكاء الاصطناعي إلى تذكرة في الأداة الصحيحة مع الأولوية والمدة والمسؤول.') },
            { icon: <Webhook size={16} />, t: L('4. Monitor here', '4. تابع من هنا'), d: L('The tool calls our webhook on every status change, so the dashboard always shows the live state.', 'تستدعي الأداة الـwebhook عند كل تغيير حالة فتعرض اللوحة الحالة الحية دائمًا.') },
          ].map((s) => (
            <div key={s.t} className="rounded-lg border border-line px-3 py-2.5">
              <div className="flex items-center gap-1.5 font-semibold mb-1" style={{ color: 'var(--violet)' }}>{s.icon}{s.t}</div>
              <div className="text-muted leading-snug">{s.d}</div>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
        {integrations.map((i) => {
          const mine = tickets.filter((t) => t.system === i.id);
          const openN = mine.filter((t) => t.status !== 'resolved').length;
          return (
            <Card
              key={i.id}
              title={<span className="inline-flex items-center gap-1.5"><Cable size={14} />{i.name}</span>}
              subtitle={`${KIND_LABEL[i.kind][lang]} - ${i.vendor}`}
              actions={<Chip tone={INT_TONE[i.status]} dot>{i.status === 'connected' ? L('Connected', 'متصل') : i.status === 'error' ? L('Error', 'خطأ') : L('Disconnected', 'غير متصل')}</Chip>}
            >
              <div className="text-[12px] space-y-1" data-testid={`int-${i.id}`}>
                <div className="flex flex-wrap gap-1">{i.departments.map((d) => <Chip key={d} tone="info">{d}</Chip>)}</div>
                <div className="text-dim truncate" title={i.endpoint}>{i.endpoint}</div>
                <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                  <Stat label={L('Open', 'مفتوحة')} value={openN} />
                  <Stat label={L('Synced', 'متزامنة')} value={i.ticketsSynced} />
                  <Stat label={L('Latency', 'الاستجابة')} value={i.status === 'connected' ? `${i.latencyMs} ms` : '-'} />
                </div>
                <div className="text-dim">{L('Last sync', 'آخر مزامنة')}: {relTime(i.lastSyncAt, lang)}{i.errorsLast24h > 0 && <span style={{ color: 'var(--warn)' }}> - {i.errorsLast24h} {L('error(s) / 24h', 'أخطاء / 24س')}</span>}</div>
                <div className="flex flex-wrap items-center gap-1.5 pt-1.5">
                  <Btn size="sm" variant="outline" onClick={() => runTest(i.id)} data-testid={`test-${i.id}`}><ShieldCheck size={13} /> {L('Test', 'اختبار')}</Btn>
                  <Btn size="sm" variant="outline" onClick={() => sync(i.id)} disabled={i.status !== 'connected'}><RefreshCw size={13} /> {L('Sync', 'مزامنة')}</Btn>
                  <Btn size="sm" variant={i.status === 'connected' ? 'ghost' : 'primary'} onClick={() => setConnected(i.id, i.status !== 'connected')} data-testid={`toggle-${i.id}`}>
                    {i.status === 'connected' ? L('Disconnect', 'قطع') : L('Connect', 'ربط')}
                  </Btn>
                  {testing[i.id] && <span className="text-[11.5px] inline-flex items-center gap-1" style={{ color: testing[i.id].startsWith('OK') ? 'var(--good)' : 'var(--dim)' }}>{testing[i.id].startsWith('OK') ? <CheckCircle2 size={12} /> : testing[i.id] === '...' ? null : <XCircle size={12} />}{testing[i.id]}</span>}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        <Card title={L('Department routing', 'توجيه الإدارات')} subtitle={L('Where each department\'s tickets go', 'إلى أين تذهب تذاكر كل إدارة')} bodyClass="!px-0">
          <table className="w-full border-collapse">
            <thead><tr><Th>{L('Department', 'الإدارة')}</Th><Th>{L('Ticketing tool', 'أداة التذاكر')}</Th><Th align="end">{L('Open tickets', 'التذاكر المفتوحة')}</Th></tr></thead>
            <tbody>
              {departments.map(([d, ints]) => (
                <tr key={d}>
                  <Td>{d}</Td>
                  <Td>{ints.map((i) => i.name).join(', ')}</Td>
                  <Td align="end" className="tabular-nums">{tickets.filter((t) => t.department === d && t.status !== 'resolved').length}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card title={L('Connection details', 'تفاصيل الاتصال')} subtitle={online ? L(`Hub online${wsLive ? ' - live updates on' : ''}`, `المركز متصل${wsLive ? ' - التحديثات الحية مفعلة' : ''}`) : L('Hub offline - using the built-in local simulator', 'المركز غير متاح - استخدام المحاكي المحلي المدمج')}>
          <div className="text-[12px] space-y-1.5">
            <div><span className="text-dim">{L('Inbound webhook', 'الـwebhook الوارد')}:</span> <code className="mono">POST {base}/api/integrations/&lt;tool&gt;/webhook</code></div>
            <div className="text-dim">{L('Body', 'المحتوى')}: <code className="mono">{'{ "ref": "INC0012345", "status": "resolved" }'}</code></div>
            <div><span className="text-dim">{L('Create ticket', 'إنشاء تذكرة')}:</span> <code className="mono">POST {base}/api/tickets</code></div>
            <div><span className="text-dim">{L('Live feed', 'البث المباشر')}:</span> <code className="mono">/ws</code></div>
          </div>
        </Card>
      </div>

      <Card title={L('Sync log', 'سجل المزامنة')} bodyClass="max-h-[220px] overflow-auto !px-0">
        <table className="w-full border-collapse">
          <tbody>
            {logs.slice(0, 40).map((l, i) => (
              <tr key={i}>
                <Td className="whitespace-nowrap text-dim tabular-nums">{new Date(l.at).toLocaleTimeString('en-GB')}</Td>
                <Td className="whitespace-nowrap"><Chip tone={l.level === 'error' ? 'bad' : l.level === 'warn' ? 'warn' : 'neutral'}>{l.system}</Chip></Td>
                <Td>{l.text}</Td>
              </tr>
            ))}
            {logs.length === 0 && <tr><Td className="text-dim">-</Td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md bg-surface-2 py-1">
      <div className="text-[15px] font-semibold tabular-nums">{value}</div>
      <div className="text-[10.5px] text-dim uppercase tracking-wide">{label}</div>
    </div>
  );
}
