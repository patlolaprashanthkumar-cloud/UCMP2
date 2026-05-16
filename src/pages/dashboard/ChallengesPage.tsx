import { useState, useEffect, useCallback } from 'react';
import { Trophy, Flame, Calendar, CalendarDays, ChevronDown, ChevronUp, Gift } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { supabase } from '../../lib/supabase';
import { formatINR } from '../../lib/format';
import { EmptyState } from '../../components/ui/EmptyState';
import { CardSkeleton } from '../../components/ui/LoadingSkeleton';
import type { Challenge, ChallengeProgress } from '../../types';

const TYPE_CONFIG: Record<string, { label: string; bg: string; icon: typeof Flame }> = {
  daily: { label: 'Daily', bg: 'bg-accent-100 text-accent-700', icon: Flame },
  weekly: { label: 'Weekly', bg: 'bg-blue-100 text-blue-700', icon: Calendar },
  monthly: { label: 'Monthly', bg: 'bg-navy-100 text-navy-700', icon: CalendarDays },
};

export function ChallengesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [progress, setProgress] = useState<Record<string, ChallengeProgress>>({});
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);

  const fetchData = useCallback(async () => {
    const [{ data: cData }, { data: pData }] = await Promise.all([
      supabase.from('challenges').select('*').eq('is_active', true).order('type'),
      supabase.from('challenge_progress').select('*').eq('user_id', user!.id),
    ]);
    setChallenges(cData || []);
    const map: Record<string, ChallengeProgress> = {};
    (pData || []).forEach((p: ChallengeProgress) => { map[p.challenge_id] = p; });
    setProgress(map);
  }, [user]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await fetchData();
      setLoading(false);
    };
    load();
  }, [fetchData]);

  const claimReward = async (challenge: Challenge) => {
    const prog = progress[challenge.id];
    if (!prog || !prog.is_completed || prog.reward_claimed) return;
    setClaiming(challenge.id);
    const { error: updateErr } = await supabase
      .from('challenge_progress')
      .update({ reward_claimed: true })
      .eq('id', prog.id);
    if (updateErr) {
      toast('Failed to claim reward. Try again.', 'error');
      setClaiming(null);
      return;
    }
    await supabase.from('transactions').insert({
      user_id: user!.id,
      type: 'bonus',
      amount: challenge.reward_amount,
      status: 'completed',
      description: `Challenge reward: ${challenge.title}`,
      reference_id: challenge.id,
    });
    const { data: wallet } = await supabase
      .from('wallets')
      .select('balance, total_earned')
      .eq('user_id', user!.id)
      .maybeSingle();
    if (wallet) {
      await supabase
        .from('wallets')
        .update({
          balance: wallet.balance + challenge.reward_amount,
          total_earned: wallet.total_earned + challenge.reward_amount,
        })
        .eq('user_id', user!.id);
    }
    toast(`Claimed ${formatINR(challenge.reward_amount)} reward!`, 'success');
    await fetchData();
    setClaiming(null);
  };

  const getProgress = (id: string) => progress[id] || null;

  const active = challenges.filter((c) => {
    const p = getProgress(c.id);
    return !p || !p.is_completed;
  });

  const completed = challenges.filter((c) => {
    const p = getProgress(c.id);
    return p?.is_completed;
  });

  const renderCard = (challenge: Challenge) => {
    const prog = getProgress(challenge.id);
    const current = prog?.current_value || 0;
    const pct = Math.min((current / challenge.target_value) * 100, 100);
    const isDone = prog?.is_completed || false;
    const claimed = prog?.reward_claimed || false;
    const cfg = TYPE_CONFIG[challenge.type] || TYPE_CONFIG.daily;
    const Icon = cfg.icon;

    return (
      <div key={challenge.id} className="bg-white rounded-xl border border-navy-100 p-5 hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-accent-50">
              <Trophy className="w-5 h-5 text-accent-500" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-navy-900">{challenge.title}</h3>
              <p className="text-xs text-navy-400 mt-0.5">{challenge.description}</p>
            </div>
          </div>
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bg}`}>
            <Icon className="w-3 h-3" />
            {cfg.label}
          </span>
        </div>

        <div className="mb-3">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-navy-500">{current} / {challenge.target_value}</span>
            <span className="font-medium text-navy-700">{Math.round(pct)}%</span>
          </div>
          <div className="w-full h-2 bg-navy-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${isDone ? 'bg-green-500' : 'bg-accent-500'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Gift className="w-4 h-4 text-accent-500" />
            <span className="text-sm font-semibold text-navy-900">{formatINR(challenge.reward_amount)}</span>
          </div>
          {isDone && !claimed && (
            <button
              onClick={() => claimReward(challenge)}
              disabled={claiming === challenge.id}
              className="bg-accent-500 hover:bg-accent-600 disabled:opacity-50 text-white text-xs font-medium px-4 py-1.5 rounded-lg transition-colors"
            >
              {claiming === challenge.id ? 'Claiming...' : 'Claim Reward'}
            </button>
          )}
          {claimed && (
            <span className="text-xs font-medium text-green-600 bg-green-50 px-3 py-1 rounded-full">
              Claimed
            </span>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <CardSkeleton key={i} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-navy-900">Challenges</h1>

      <div>
        <h2 className="text-lg font-semibold text-navy-900 mb-3">Active Challenges</h2>
        {active.length === 0 ? (
          <EmptyState
            icon={<Trophy className="w-8 h-8 text-navy-300" />}
            title="No active challenges"
            description="Check back later for new challenges to earn rewards."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {active.map(renderCard)}
          </div>
        )}
      </div>

      {completed.length > 0 && (
        <div>
          <button
            onClick={() => setShowCompleted(!showCompleted)}
            className="flex items-center gap-2 text-lg font-semibold text-navy-900 mb-3 hover:text-accent-600 transition-colors"
          >
            Completed Challenges ({completed.length})
            {showCompleted ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
          {showCompleted && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {completed.map(renderCard)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
