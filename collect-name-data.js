// ================================================
// 대법원 이름 통계 데이터 수집 스크립트
// 대법원 통계 사이트(stfamily.scourt.go.kr)에서
// 브라우저 콘솔에 붙여넣어 실행하세요
// ================================================
// 실행 방법:
// 1. https://stfamily.scourt.go.kr/st/StFrrStatcsView.do?pgmId=090000000025
//    위 주소 접속
// 2. F12 → Console 탭
// 3. 이 코드 전체 붙여넣기 후 엔터
// 4. 완료되면 콘솔에 JSON 출력됨 → 복사해서 저장
// ================================================

(async function collectNameData() {
  const TARGET = 'https://stfamily.scourt.go.kr/ds/report/query.do';
  const results = {};
  const errors = [];

  // 수집 연도 범위
  const years = [];
  for (let y = 2008; y <= 2025; y++) years.push(y);

  // 성별 (전체/남/여)
  const genders = [
    { code: '_EMPTY_VALUE_', label: 'all' },
    { code: 'M', label: 'male' },
    { code: 'F', label: 'female' },
  ];

  console.log('📊 대법원 이름 통계 수집 시작...');
  console.log(`총 ${years.length}년 × 3성별 = ${years.length * 3}회 요청`);

  function makeParams(year, genderCode) {
    return JSON.stringify({
      "@MultiCandType":  { value: "YY", type: "STRING", defaultValue: "" },
      "@MultiCandStDt":  { value: [String(year)], type: "STRING", defaultValue: "" },
      "@MultiCandEdDt":  { value: [String(year)], type: "STRING", defaultValue: "" },
      "@SidoCd":  { value: "All", type: "STRING", defaultValue: "All", whereClause: "C.SIDO_CD" },
      "@CggCd":   { value: "_EMPTY_VALUE_", type: "STRING", defaultValue: "All", whereClause: "D.CGG_CD" },
      "@UmdCd":   { value: "_EMPTY_VALUE_", type: "STRING", defaultValue: "All", whereClause: "E.UMD_CD" },
      "@GenderCd":{ value: genderCode, type: "STRING", defaultValue: "All", whereClause: "F.GENDER_CD" },
    });
  }

  async function fetchData(year, gender) {
    const formData = new URLSearchParams({
      pid: '1811',
      uid: '999999',
      dsid: '1261',
      dstype: 'DS',
      sqlid: '1811-1',
      mapid: 'dcea0891-75fa-4cbd-b40f-72986a16abf6',
      params: makeParams(year, gender.code),
    });

    const res = await fetch(TARGET, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
      body: formData.toString(),
    });
    return await res.json();
  }

  // 순차 수집 (서버 부하 방지 - 500ms 간격)
  for (const year of years) {
    results[year] = {};
    for (const gender of genders) {
      try {
        const data = await fetchData(year, gender);
        results[year][gender.label] = (data.data || []).map(d => ({
          rank: d['순위'],
          name: d['이름'],
          count: d['건수'],
          pct: d['전체비율'],
        }));
        console.log(`✅ ${year}년 ${gender.label}: ${results[year][gender.label].length}개`);
      } catch (e) {
        console.error(`❌ ${year}년 ${gender.label} 실패:`, e.message);
        errors.push({ year, gender: gender.label, error: e.message });
        results[year][gender.label] = [];
      }
      // 서버 부하 방지
      await new Promise(r => setTimeout(r, 500));
    }
  }

  // 결과 출력
  const output = {
    meta: {
      source: '대한민국 법원 전자가족관계등록시스템 통계서비스',
      url: 'https://stfamily.scourt.go.kr',
      collected: new Date().toISOString().slice(0, 10),
      yearRange: `${years[0]}-${years[years.length-1]}`,
      errors: errors,
    },
    data: results,
  };

  console.log('\n🎉 수집 완료!');
  console.log(`총 ${years.length}년 데이터 수집됨`);
  if (errors.length) console.warn(`⚠️ 실패: ${errors.length}건`);
  console.log('\n📋 아래 JSON을 복사해서 name-data.json으로 저장하세요:');
  console.log('='.repeat(60));
  console.log(JSON.stringify(output, null, 2));

  // 자동 다운로드 시도
  try {
    const blob = new Blob([JSON.stringify(output, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'name-data.json';
    a.click();
    console.log('✅ name-data.json 자동 다운로드 시작됨!');
  } catch (e) {
    console.log('자동 다운로드 안 됨 - 콘솔에서 직접 복사하세요');
  }

  return output;
})();
