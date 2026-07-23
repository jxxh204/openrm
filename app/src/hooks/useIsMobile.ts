import { useEffect, useState } from 'react'

// 폰 판정 — matchMedia 구독. CSS만으로 안 되는 JS 분기(모바일 셸 전환·데스크톱 전용 게이팅)에 쓴다.
// 640px 이하를 '폰'으로 본다(태블릿/좁은 창은 기존 980/620 @media가 커버).
export function useIsMobile(query = '(max-width: 640px)'): boolean {
	const [match, setMatch] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches)
	useEffect(() => {
		const mq = window.matchMedia(query)
		const on = () => setMatch(mq.matches)
		on() // 마운트 시 현재값 반영(초기 SSR/렌더 불일치 방지)
		mq.addEventListener('change', on)
		return () => mq.removeEventListener('change', on)
	}, [query])
	return match
}

export default useIsMobile
