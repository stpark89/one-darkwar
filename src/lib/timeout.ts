// supabase fetch 등 외부 의존 Promise 가 hang 되어도 일정 시간 안에 강제로
// 풀리도록 race timeout 을 걸어주는 헬퍼. 각 store 의 load 함수에서
// fetch 호출을 이걸로 감싸면 어떤 경로로 끝나든 loading 이 stuck 되지 않는다.
//
// 사용 예:
//   const fetchA = async () => supabase.from('foo').select('*')
//   const result = await withTimeout(fetchA(), 15000)

export function withTimeout<T>(p: Promise<T>, ms = 15000): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ])
}
