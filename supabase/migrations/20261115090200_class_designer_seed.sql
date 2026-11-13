-- 기본 설정과 연결 통계 태그 (원본 seed.sql · migrations 006·007). 이미 있으면 그대로 둠
insert into class_designer.settings (k, v) values
('ai_provider', 'gemini'),                 -- gemini | mock(키 없이 시험할 때)
('ai_model', 'gemini-3.8-flash'),
('std_search_model', 'gemini-3.5-flash'),
('google_domain', 'bmrschool.org'),        -- 이 도메인의 구글 계정은 처음 로그인할 때 교사로 자동 등록
('first_admin_email', ''),                 -- 이 메일로 처음 로그인하면 관리자 (MIGRATION.md 참고)
('limit_user_daily_calls', '40'),
('limit_user_monthly_calls', '400'),
('limit_user_monthly_cost_krw', '5000'),
('limit_school_monthly_cost_krw', '50000'),
('limit_school_monthly_calls', '5000'),
('ai_log_retention_days', '90'),
('price_in_per_1k_krw', '0.5'),
('price_out_per_1k_krw', '2')
on conflict (k) do nothing;

insert into class_designer.tag_codes (code,kind,name,sort) values
('VAL:공동체','value','공동체',1),
('VAL:제자도','value','제자도',2),
('VAL:샬롬','value','샬롬',3),
('VAL:소명','value','소명',4),
('COMP:비판적 사고력','competency','비판적 사고력',11),
('COMP:창의적 사고력','competency','창의적 사고력',12),
('COMP:실천적 사고력','competency','실천적 사고력',13),
('COMP:의사소통능력','competency','의사소통능력',14),
('COMP:의사소통기술','competency','의사소통기술',15),
('COMP:협업능력','competency','협업능력',16),
('COMP:자기주도성','competency','자기주도성',17),
('COMP:타인 존중','competency','타인 존중',18),
('COMP:리더십','competency','리더십',19),
('GOAL:1','goal','창조세계를 알고 청지기적 소명을 실천하는 사람',21),
('GOAL:2','goal','진리를 알고 사랑하는 사람',22),
('GOAL:3','goal','나를 알고 스스로 성장해 가는 사람',23)
on conflict (code) do nothing;
