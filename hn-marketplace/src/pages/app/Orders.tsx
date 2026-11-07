import { useState } from 'react';
import { Briefcase } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAsync, q } from '@/lib/hooks';
import { useAuth } from '@/context/AuthContext';
import type { Order, OrderStatus } from '@/lib/types';
import { ButtonLink, Card, EmptyState, ErrorBox, PageHeader, Skeleton, Tabs } from '@/components/ui';
import { OrderRow, ORDER_LIST_SELECT } from './Dashboard';

const GROUPS: Record<string, OrderStatus[]> = {
  active: ['pending_acceptance', 'active', 'revision_requested', 'delivered', 'disputed'],
  pending: ['pending_payment'],
  completed: ['completed'],
  cancelled: ['cancelled', 'refunded'],
};

export default function Orders() {
  const { profile } = useAuth();
  const [tab, setTab] = useState<keyof typeof GROUPS | 'all'>('active');
  const isFreelancer = profile?.role === 'freelancer';
  const { data, loading, error, reload } = useAsync(async () => {
    let query = supabase.from('orders').select(ORDER_LIST_SELECT).order('updated_at', { ascending: false }).limit(300);
    query = isFreelancer ? query.eq('freelancer_id', profile!.id) : query.eq('client_id', profile!.id);
    return q(query) as Promise<Order[]>;
  }, [profile?.id, isFreelancer]);
  const orders = data ?? [];
  const count = (k: keyof typeof GROUPS) => orders.filter((o) => GROUPS[k].includes(o.status)).length;
  const shown = tab === 'all' ? orders : orders.filter((o) => GROUPS[tab].includes(o.status));
  return (
    <div>
      <PageHeader title={isFreelancer ? 'Orders' : 'My orders'} subtitle={isFreelancer ? 'Projects clients have bought from you.' : 'Everything you have ordered.'} />
      <Tabs value={tab} onChange={setTab} tabs={[
        { value: 'active', label: 'Active', count: count('active') },
        { value: 'pending', label: isFreelancer ? 'Awaiting payment' : 'Pending payment', count: count('pending') },
        { value: 'completed', label: 'Completed', count: count('completed') },
        { value: 'cancelled', label: 'Cancelled', count: count('cancelled') },
        { value: 'all', label: 'All' },
      ]} />
      <Card className="mt-4 overflow-hidden">
        {error && <div className="p-4"><ErrorBox message={error} onRetry={reload} /></div>}
        {loading ? <div className="space-y-2 p-4">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-14" />)}</div>
          : shown.length ? shown.map((o) => <OrderRow key={o.id} o={o} viewer={isFreelancer ? 'freelancer' : 'client'} />)
          : <div className="p-6"><EmptyState icon={Briefcase} title="Nothing here" text={isFreelancer ? 'Orders appear here once clients buy your gigs or accept your offers.' : 'Orders you place appear here.'}
              action={!isFreelancer ? <ButtonLink to="/explore">Explore services</ButtonLink> : undefined} /></div>}
      </Card>
    </div>
  );
}
