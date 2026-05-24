// 동맹 아바타 풀(pool). 사이드바 로고, 모바일 헤더, 게스트 홈 히어로 등에서
// 사용됩니다. 사진을 추가하려면:
//   1) public/profiles/ 폴더에 PNG/JPG 파일을 추가
//   2) 아래 ALLIANCE_AVATARS 배열에 경로를 추가
// 페이지 진입 시 한 번 무작위로 골라 그 세션 동안 동일 이미지를 유지하여
// 라우트 이동 시 아이콘이 깜빡이지 않도록 캐시합니다.

export const ALLIANCE_AVATARS: string[] = [
  '/bunny-source.png',
]

let _sessionAvatar: string | null = null

export const getSessionAvatar = (): string => {
  if (_sessionAvatar) return _sessionAvatar
  const pool = ALLIANCE_AVATARS.length > 0 ? ALLIANCE_AVATARS : ['/icon-512.png']
  _sessionAvatar = pool[Math.floor(Math.random() * pool.length)]
  return _sessionAvatar
}
