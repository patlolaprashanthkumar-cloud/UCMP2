import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Crown, Trophy, Medal, Star, TrendingUp } from 'lucide-react';
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
        data.map((d: any, i: number) => ({
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

  const demoEntries: LeaderEntry[] = [
    { id: '1', user_id: '1', month: '', earnings: 187500, rank: 1, user_name: 'Rajesh Kumar' },
    { id: '2', user_id: '2', month: '', earnings: 156200, rank: 2, user_name: 'Priya Sharma' },
    { id: '3', user_id: '3', month: '', earnings: 134800, rank: 3, user_name: 'Amit Patel' },
    { id: '4', user_id: '4', month: '', earnings: 112000, rank: 4, user_name: 'Sneha Reddy' },
    { id: '5', user_id: '5', month: '', earnings: 98500, rank: 5, user_name: 'Vikram Singh' },
    { id: '6', user_id: '6', month: '', earnings: 87200, rank: 6, user_name: 'Ananya Iyer' },
    { id: '7', user_id: '7', month: '', earnings: 76800, rank: 7, user_name: 'Deepak Joshi' },
    { id: '8', user_id: '8', month: '', earnings: 65400, rank: 8, user_name: 'Kavita Nair' },
    { id: '9', user_id: '9', month: '', earnings: 54100, rank: 9, user_name: 'Manish Gupta' },
    { id: '10', user_id: '10', month: '', earnings: 43200, rank: 10, user_name: 'Ritu Verma' },
  ];

  const displayEntries = entries.length > 0 ? entries : demoEntries;

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
          <Link to="/signup" className="text-sm font-semibold text-white bg-accent-500 hover:bg-accent-600 px-5 py-2.5 rounded-xl transition-all">
            Join Now
          </Link>
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
          ) : (
            <div className="space-y-3">
              {displayEntries.map((entry, index) => {
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
        </div>
      </section>
    </div>
  );
}
