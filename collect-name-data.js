// ================================================
// 대법원 이름 통계 데이터 수집 스크립트 v2
// 월별로 나눠서 수집 후 합산
// stfamily.scourt.go.kr 콘솔에서 실행
// ================================================

(async function collectNameData() {
  const TARGET = 'https://stfamily.scourt.go.kr/ds/report/query.do';
  const results = {};
  const errors = [];

  // 2008~2025년, 월별 수집
  const periods = [];
  for (let y = 2023; y <= 2025; y++) {   // 일단 2023~2025 먼저 테스트
    for (let m = 1; m <= 12; m++) {
      const lastDay = new Date(y, m, 0).getDate();
      const start = `${y}${String(m).padStart(2,'0')}01`;
      const end   = `${y}${String(m).padStart(2,'0')}${lastDay}`;
      // 미래 날짜 스킵
      const today = new Date();
      if (new Date(y, m-1, 1) > today) continue;
      periods.push({ year: y, month: m, start, end });
    }
  }

  const genders = [
    { code: '_EMPTY_VALUE_', label: 'all' },
    { code: 'M', label: 'male' },
    { code: 'F', label: 'female' },
  ];

  console.log(`📊 수집 시작: ${periods.length}개 기간 × 3성별 = ${periods.length * 3}회 요청`);
  console.log('⏱ 예상 소요 시간:', Math.round(periods.length * 3 * 0.6), '초');

  function makeParams(start, end, genderCode) {
    return JSON.stringify({
      "@MultiCandType":  { value: "DT", type: "STRING", defaultValue: "" },
      "@MultiCandStDt":  { value: [start], type: "STRING", defaultValue: "" },
      "@MultiCandEdDt":  { value: [end],   type: "STRING", defaultValue: "" },
      "@SidoCd":  { value: "All", type: "STRING", defaultValue: "All", whereClause: "C.SIDO_CD" },
      "@CggCd":   { value: "_EMPTY_VALUE_", type: "STRING", defaultValue: "All", whereClause: "D.CGG_CD" },
      "@UmdCd":   { value: "_EMPTY_VALUE_", type: "STRING", defaultValue: "All", whereClause: "E.UMD_CD" },
      "@GenderCd":{ value: genderCode, type: "STRING", defaultValue: "All", whereClause: "F.GENDER_CD" },
    });
  }

  async function fetchData(start, end, gender) {
    const formData = new URLSearchParams({
      pid: '1811', uid: '999999', dsid: '1261', dstype: 'DS', sqlid: '1811-1',
      mapid: 'dcea0891-75fa-4cbd-b40f-72986a16abf6',
      params: makeParams(start, end, gender.code),
    });
    const res = await fetch(TARGET, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
      body: formData.toString(),
    });
    return await res.json();
  }

  // 월별 데이터를 연도별로 합산
  const yearData = {};

  for (const p of periods) {
    if (!yearData[p.year]) yearData[p.year] = { all:{}, male:{}, female:{} };

    for (const gender of genders) {
      try {
        const data = await fetchData(p.start, p.end, gender);
        const items = data.data || [];

        // 이름별 건수 누적
        items.forEach(d => {
          const name = d['이름'];
          const count = d['건수'] || 0;
          const key = gender.label;
          if (!yearData[p.year][key][name]) yearData[p.year][key][name] = 0;
          yearData[p.year][key][name] += count;
        });

        console.log(`✅ ${p.year}년 ${p.month}월 ${gender.label}: ${items.length}개`);
      } catch (e) {
        console.error(`❌ ${p.year}년 ${p.month}월 ${gender.label}:`, e.message);
        errors.push({ year: p.year, month: p.month, gender: gender.label });
      }
      await new Promise(r => setTimeout(r, 400));
    }
  }

  // 연도별 데이터를 순위 배열로 변환
  const finalData = {};
  for (const [year, gData] of Object.entries(yearData)) {
    finalData[year] = {};
    for (const [gLabel, nameMap] of Object.entries(gData)) {
      const sorted = Object.entries(nameMap)
        .sort((a, b) => b[1] - a[1])
        .map(([name, count], i) => ({ rank: i+1, name, count }));
      finalData[year][gLabel] = sorted;
    }
  }

  const output = {
    meta: {
      source: '대한민국 법원 전자가족관계등록시스템 통계서비스',
      collected: new Date().toISOString().slice(0,10),
      note: '월별 수집 후 연간 합산',
      errors,
    },
    data: finalData,
  };

  console.log('\n🎉 수집 완료!');
  console.log(JSON.stringify(output).slice(0, 200) + '...');

  // 자동 다운로드
  try {
    const blob = new Blob([JSON.stringify(output, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'name-data.json'; a.click();
    console.log('✅ name-data.json 다운로드 시작!');
  } catch(e) {
    console.log('콘솔에서 직접 복사하세요:', JSON.stringify(output));
  }

  return output;
})();
