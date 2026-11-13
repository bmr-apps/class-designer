// Limits.php 포팅 (순수 판정)
import { toFloat } from './php.ts';
export function evaluateLimits(usage: Record<string, unknown>, limits: Record<string, unknown>): string | null {
  const checks: [string, string, string][] = [
    ['user_day_calls', 'limit_user_daily_calls', '오늘 개인 호출 한도'],
    ['user_month_calls', 'limit_user_monthly_calls', '이번 달 개인 호출 한도'],
    ['user_month_cost', 'limit_user_monthly_cost_krw', '이번 달 개인 비용 한도'],
    ['school_month_calls', 'limit_school_monthly_calls', '학교 전체 월 호출 한도'],
    ['school_month_cost', 'limit_school_monthly_cost_krw', '학교 전체 월 예산'],
  ];
  for (const [u, l, label] of checks) {
    const lim = toFloat(limits[l] ?? 0);
    if (lim > 0 && toFloat(usage[u] ?? 0) >= lim) return `${label} 에 도달했습니다. 관리자에게 문의하세요.`;
  }
  return null;
}
