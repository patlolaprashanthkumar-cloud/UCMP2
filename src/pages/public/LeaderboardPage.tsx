import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Crown, Trophy, Medal, Star, TrendingUp, LayoutDashboard } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { formatINR, maskName } from '../../lib/format';
import { Skeleton } from '../../components/ui/LoadingSkeleton';

interface LeaderEntry {
  id: string;
  user_id: string;
  month: string;
  earnings: number;
  rank: number | null;
  user_name: string;
}

const badges = [
  { min: 0, label: 'Newcomer', color: 'bg-navy-100 text-navy-600' },
  { min: 1000, label: 'Rising Star', color: 'bg-accent-100 text-accent-700' },
  { min: 10000, label: 'Top Seller', color: 'bg-success-100 text-success-700' },
  { min: 50000, label: 'Power Vendor', color: 'bg-warning-100 text-warning-700' },
];

function getBadge(earnings: number) {
  return [...badges].reverse().find((b) => earnings >= b.min) || badges[0];
}

const rankIcons = [
  <Trophy className="w-6 h-6 text-yellow-500" />,
  <Medal className="w-6 h-6 text-gray-400" />,
  <Medal className="w-6 h-6 text-amber-600" />,
];

export function LeaderboardPage() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<LeaderEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLeaderboard();
  }, []);

  async function loadLeaderboard() {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const { data } = await supabase
      .from('leaderboard')
      .select('*, profiles!leaderboard_user_id_fkey(name)')
      .eq('month', currentMonth)
      .order('earnings', { ascending: false })
      .limit(10);

    if (data) {
      setEntries(
        data.map((d: { id: string; user_id: string; month: string; earnings: number; profiles?: { name?: string } }, i: number) => ({
          id: d.id,
          user_id: d.user_id,
          month: d.month,
          earnings: d.earnings,
          rank: i + 1,
          user_name: d.profiles?.name || 'Anonymous',
        }))
      );
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-white">
      <nav className="fixed top-0 inset-x-0 z-50 bg-white/80 backdrop-blur-xl border-b border-navy-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-accent-500 rounded-lg flex items-center justify-center">
              <Crown className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-navy-900">UCMP</span>
          </Link>
          {user ? (
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 text-sm font-semibold text-white bg-accent-500 hover:bg-accent-600 px-5 py-2.5 rounded-xl transition-all"
            >
              <LayoutDashboard className="w-4 h-4" />
              Dashboard
            </Link>
          ) : (
            <Link to="/signup" className="text-sm font-semibold text-white bg-accent-500 hover:bg-accent-600 px-5 py-2.5 rounded-xl transition-all">
              Join Now
            </Link>
          )}
        </div>
      </nav>

      <section className="pt-32 pb-20 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <div className="w-16 h-16 bg-accent-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Trophy className="w-8 h-8 text-accent-500" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-navy-900 mb-2">Top Earners</h1>
            <p className="text-navy-500">This month's highest earners on UCMP</p>
          </div>

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-xl" />
              ))}
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-12 px-4 rounded-xl border border-navy-100 bg-navy-50/50">
              <p className="text-navy-700 font-medium">No leaderboard data for this month yet.</p>
              <p className="text-sm text-navy-500 mt-2">Check back once earnings are recorded for {new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' })}.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {entries.map((entry, index) => {
                const badge = getBadge(entry.earnings);
                return (
                  <div
                    key={entry.id}
                    className={`flex items-center gap-4 p-4 rounded-xl border transition-all hover:shadow-md ${
                      index < 3 ? 'bg-accent-50/50 border-accent-100' : 'bg-white border-navy-100'
                    }`}
                  >
                    <div className="w-10 h-10 flex items-center justify-center">
                      {index < 3 ? (
                        rankIcons[index]
                      ) : (
                        <span className="text-lg font-bold text-navy-400">#{entry.rank}</span>
                      )}
                    </div>
                    <div className="w-10 h-10 rounded-full bg-navy-100 flex items-center justify-center text-navy-600 font-bold text-sm">
                      {entry.user_name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-navy-900">{maskName(entry.user_name)}</p>
                      <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full mt-0.5 ${badge.color}`}>
                        {badge.label}
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-navy-900">{formatINR(entry.earnings)}</p>
                      <p className="text-xs text-navy-500 flex items-center gap-1 justify-end">
                        <TrendingUp className="w-3 h-3 text-success-500" />
                        this month
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {!user && (
            <div className="text-center mt-10">
              <p className="text-navy-500 mb-4">Want to see your name here?</p>
              <Link
                to="/signup"
                className="inline-flex items-center gap-2 px-8 py-3 bg-accent-500 hover:bg-accent-600 text-white font-semibold rounded-xl transition-all"
              >
                <Star className="w-5 h-5" />
                Start Earning Today
              </Link>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
