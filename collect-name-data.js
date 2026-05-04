// ================================================
// 대법원 이름 통계 데이터 수집 스크립트 v3
// stfamily.scourt.go.kr 콘솔에서 실행
// ================================================

(async function collectNameData() {
  const TARGET = 'https://stfamily.scourt.go.kr/ds/report/query.do';
  const errors = [];

  // 수집 기간: 월별로 나눠서 수집
  const periods = [];
  const today = new Date();
  for (let y = 2023; y <= 2026; y++) {
    for (let m = 1; m <= 12; m++) {
      const firstDay = new Date(y, m-1, 1);
      if (firstDay > today) break;
      const lastDay = new Date(y, m, 0).getDate();
      const start = `${y}${String(m).padStart(2,'0')}01`;
      const end   = `${y}${String(m).padStart(2,'0')}${String(Math.min(lastDay, today.getDate() * (y===today.getFullYear()&&m===today.getMonth()+1?1:99))).padStart(2,'0')}`;
      // 이번달이면 어제까지
      const endDate = (y===today.getFullYear()&&m===today.getMonth()+1)
        ? `${y}${String(m).padStart(2,'0')}${String(today.getDate()-1).padStart(2,'0')}`
        : `${y}${String(m).padStart(2,'0')}${lastDay}`;
      if (parseInt(endDate.slice(6)) < 1) continue;
      periods.push({ year: y, month: m, start, end: endDate });
    }
  }

  const genders = [
    { code: '_EMPTY_VALUE_', label: 'all' },
    { code: 'M', label: 'male' },
    { code: 'F', label: 'female' },
  ];

  console.log(`📊 수집 시작: ${periods.length}기간 × 3성별 = ${periods.length*3}회`);

  function makeParams(start, end, genderCode, sidoCd) {
    return JSON.stringify({
      "@MultiCandType": { value: ["DT"], type: "STRING", defaultValue: "" },
      "@MultiCandStDt": { value: [start], type: "STRING", defaultValue: "" },
      "@MultiCandEdDt": { value: [end],   type: "STRING", defaultValue: "" },
      "@SidoCd": { value: [sidoCd||"_EMPTY_VALUE_"], type: "STRING", defaultValue: "[All]", whereClause: "C.SIDO_CD" },
      "@CggCd":  { value: ["_EMPTY_VALUE_"], type: "STRING", defaultValue: "[All]", whereClause: "D.CGG_CD" },
      "@UmdCd":  { value: ["_EMPTY_VALUE_"], type: "STRING", defaultValue: "[All]", whereClause: "E.UMD_CD" },
      "@GenderCd": { value: [genderCode], type: "STRING", defaultValue: "[All]", whereClause: "F.GENDER_CD" },
    });
  }

  async function fetchData(start, end, gender) {
    const body = new URLSearchParams({
      pid: '1811', uid: '999999', dsid: '1261', dstype: 'DS',
      sqlid: '1811-1',
      mapid: 'dcea0891-75fa-4cbd-b40f-72986a16abf6',
      params: makeParams(start, end, gender.code),
    });
    const res = await fetch(TARGET, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
      body: body.toString(),
    });
    const text = await res.text();
    return JSON.parse(text);
  }

  // 연도별 이름 건수 누적
  const yearData = {};

  for (const p of periods) {
    if (!yearData[p.year]) yearData[p.year] = { all:{}, male:{}, female:{} };

    for (const gender of genders) {
      try {
        const data = await fetchData(p.start, p.end, gender);
        const items = data.data || [];
        items.forEach(d => {
          const name = d['이름'];
          const count = d['건수'] || 0;
          if (!yearData[p.year][gender.label][name]) yearData[p.year][gender.label][name] = 0;
          yearData[p.year][gender.label][name] += count;
        });
        console.log(`✅ ${p.year}.${String(p.month).padStart(2,'0')} ${gender.label}: ${items.length}개`);
      } catch(e) {
        console.error(`❌ ${p.year}.${p.month} ${gender.label}:`, e.message);
        errors.push({ year: p.year, month: p.month, gender: gender.label, error: e.message });
      }
      await new Promise(r => setTimeout(r, 300));
    }
  }

  // 순위 배열로 변환
  const finalData = {};
  for (const [year, gData] of Object.entries(yearData)) {
    finalData[year] = {};
    for (const [gLabel, nameMap] of Object.entries(gData)) {
      finalData[year][gLabel] = Object.entries(nameMap)
        .sort((a,b) => b[1]-a[1])
        .map(([name, count], i) => ({ rank: i+1, name, count }));
    }
  }

  const output = {
    meta: {
      source: '대한민국 법원 전자가족관계등록시스템',
      collected: new Date().toISOString().slice(0,10),
      errors,
    },
    data: finalData,
  };

  console.log('\n🎉 완료!', JSON.stringify(output).slice(0,200));

  const blob = new Blob([JSON.stringify(output,null,2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'name-data.json';
  a.click();
  console.log('✅ name-data.json 다운로드!');

  return output;
})();
