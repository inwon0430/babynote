// ================================================
// 대법원 이름 통계 수집 스크립트 v4
// 연도별(YY) × 시도별 × 성별 전체 수집
// stfamily.scourt.go.kr 콘솔에서 실행
// ================================================

(async function collectNameData() {
  const TARGET = 'https://stfamily.scourt.go.kr/ds/report/query.do';
  const errors = [];

  const years = [];
  for (let y = 2008; y <= 2026; y++) years.push(y);

  const genders = [
    { code: '_EMPTY_VALUE_', label: 'all' },
    { code: '1', label: 'male' },
    { code: '2', label: 'female' },
  ];

  // 전국 = 현재 + 구 행정구역 코드 모두 포함
  const ALL_SIDO_CODES = [
    "11","26","27","28","29","30","31","36",  // 서울,부산,대구,인천,광주,대전,울산,세종
    "41","42","43","44","45","46","47","48","50",  // 경기,강원,충북,충남,전북,전남,경북,경남,제주
    "21","22","23","24","25",  // 구 직할시: 대전,부산,대구,광주,인천
  ];

  const sidos = [
    { codes: ALL_SIDO_CODES, label: '전국' },
    { codes: ['11'], label: '서울' },
    { codes: ['26','22'], label: '부산' },  // 현재+구 코드
    { codes: ['27','23'], label: '대구' },
    { codes: ['28','25'], label: '인천' },
    { codes: ['29','24'], label: '광주' },
    { codes: ['30','21'], label: '대전' },
    { codes: ['31'], label: '울산' },
    { codes: ['36'], label: '세종' },
    { codes: ['41'], label: '경기' },
    { codes: ['42'], label: '강원' },
    { codes: ['43'], label: '충북' },
    { codes: ['44'], label: '충남' },
    { codes: ['45'], label: '전북' },
    { codes: ['46'], label: '전남' },
    { codes: ['47'], label: '경북' },
    { codes: ['48'], label: '경남' },
    { codes: ['50'], label: '제주' },
  ];

  const totalReqs = years.length * genders.length * sidos.length;
  console.log(`📊 수집 시작: ${years.length}년 × ${genders.length}성별 × ${sidos.length}시도 = ${totalReqs}회`);
  console.log(`⏱ 예상 소요 시간: 약 ${Math.round(totalReqs * 0.4 / 60)}분`);

  function makeParams(year, genderCode, sidoCodes) {
    return JSON.stringify({
      "@MultiCandType": { value: ["YY"], type: "STRING", defaultValue: "" },
      "@MultiCandStDt": { value: [String(year)], type: "STRING", defaultValue: "" },
      "@MultiCandEdDt": { value: [String(year)], type: "STRING", defaultValue: "" },
      "@SidoCd":  { value: sidoCodes, type: "STRING", defaultValue: "All", whereClause: "C.SIDO_CD" },
      "@CggCd":   { value: ["_EMPTY_VALUE_"], type: "STRING", defaultValue: "All", whereClause: "D.CGG_CD" },
      "@UmdCd":   { value: ["_EMPTY_VALUE_"], type: "STRING", defaultValue: "All", whereClause: "E.UMD_CD" },
      "@GenderCd":{ value: [genderCode], type: "STRING", defaultValue: "All", whereClause: "F.GENDER_CD" },
    });
  }

  async function fetchData(year, gender, sido) {
    const body = new URLSearchParams({
      pid: '1811', uid: '999999', dsid: '1261', dstype: 'DS',
      sqlid: '1811-1',
      mapid: 'dcea0891-75fa-4cbd-b40f-72986a16abf6',
      params: makeParams(year, gender.code, sido.codes),
    });
    const res = await fetch(TARGET, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
      body: body.toString(),
    });
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch(e) {
      throw new Error(`파싱실패: ${text.slice(0,80)}`);
    }
  }

  // 결과 구조: { year: { gender: { sido: [{rank,name,count}] } } }
  // + 전국 합산: { year: { gender: { 전국: [{rank,name,count}] } } }
  const raw = {};

  let done = 0;
  for (const year of years) {
    raw[year] = {};
    for (const gender of genders) {
      raw[year][gender.label] = {};
      for (const sido of sidos) {
        try {
          const data = await fetchData(year, gender, sido);
          const items = (data.data || []).map(d => ({
            rank: d['순위'],
            name: d['이름'],
            count: d['건수'],
          }));
          raw[year][gender.label][sido.label] = items;
          done++;
          if (done % sidos.length === 0) {
            console.log(`✅ ${year}년 ${gender.label} 완료 (${done}/${totalReqs})`);
          }
        } catch(e) {
          console.error(`❌ ${year}/${gender.label}/${sido.label}:`, e.message);
          errors.push({ year, gender: gender.label, sido: sido.label });
          raw[year][gender.label][sido.label] = [];
        }
        await new Promise(r => setTimeout(r, 300));
      }
    }
  }

  const output = {
    meta: {
      source: '대한민국 법원 전자가족관계등록시스템',
      collected: new Date().toISOString().slice(0, 10),
      type: 'yearly+sido',
      sidos: sidos.map(s => s.label),
      errors,
    },
    data: raw,
  };

  console.log(`\n🎉 수집 완료! 에러: ${errors.length}건`);

  const blob = new Blob([JSON.stringify(output, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'name-data-full.json';
  a.click();
  console.log('✅ name-data-full.json 다운로드 시작!');

  return output;
})();
