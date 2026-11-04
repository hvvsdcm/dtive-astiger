-- Local development seed (supabase db reset). NOT for production.
-- Accounts below exist only in the local stack; their passwords are public and local-only.
--   admin@example.com    / Admin1234!     (row in public.admins)
--   customer@example.com / Customer1234!
-- Image files: supabase/seed-assets (fetched by scripts/fetch-seed-images.mjs, sources in CREDITS.md).
-- UUIDs are fixed so that image object paths in seed-assets match the rows below.

-- Users ------------------------------------------------------------------------------------------

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token
)
values
  (
    '00000000-0000-0000-0000-000000000000', 'a0000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
    'admin@example.com', extensions.crypt('Admin1234!', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}',
    '{"name":"관리자","terms_agreed":true,"privacy_agreed":true,"marketing_agreed":false}',
    now(), now(), '', '', '', '', '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000', 'c0000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
    'customer@example.com', extensions.crypt('Customer1234!', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}',
    '{"name":"김고객","phone":"01012345678","terms_agreed":true,"privacy_agreed":true,"marketing_agreed":true}',
    now(), now(), '', '', '', '', '', '', '', ''
  );

insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text, 'email',
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true, 'phone_verified', false),
       now(), now(), now()
  from auth.users u
 where u.id in ('a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002');

insert into public.admins (user_id, note) values ('a0000000-0000-4000-8000-000000000001', 'local seed');

-- Settings ---------------------------------------------------------------------------------------

insert into public.site_settings (id, shipping_fee, free_shipping_threshold, bank_name, bank_account, bank_holder, payment_due_hours)
values (1, 3000, 100000, '국민은행', '000000-00-000000', '디티브아시티거', 48);

-- Catalog ----------------------------------------------------------------------------------------

insert into public.categories (id, slug, name, parent_id, image_path, sort)
values
  ('3522c0db-45c4-4900-862d-65019478e239', 'women', 'WOMEN', null, 'products/2b83f8e4-52d6-4437-9a1e-8f3914d61f97/3611102d-a7ff-4a04-9a13-06ee6a6c9c96.webp', 0),
  ('475178f9-197d-41eb-907a-892c1710a711', 'men', 'MEN', null, 'products/76f8ccef-c877-4294-8e1a-fbee7e4cd361/d1f74857-e37d-46ec-a6c2-86c64e5bdb87.webp', 1),
  ('650be103-ef2c-4901-a0a3-331da87adde0', 'accessories', 'ACCESSORIES', null, 'products/ff852101-ab0c-431e-bcad-22ac716ac50e/fde89ef6-3918-4848-b2ae-1d5be4f8353e.webp', 2),
  ('ad0de5f6-dcaa-499c-8ce7-26cea17397c5', 'women-outerwear', '아우터', '3522c0db-45c4-4900-862d-65019478e239', 'products/2b83f8e4-52d6-4437-9a1e-8f3914d61f97/3611102d-a7ff-4a04-9a13-06ee6a6c9c96.webp', 0),
  ('2da275ce-f57f-41cb-9e4f-daf80bbc8770', 'women-knitwear', '니트', '3522c0db-45c4-4900-862d-65019478e239', 'products/919a4d80-fa82-4aa9-893c-9a95d89c0989/fff22d97-0257-4984-b9dc-2373692ede7c.webp', 1),
  ('fb36e49d-f7b0-458c-baf4-46ef0cf57ed4', 'women-shirts', '셔츠', '3522c0db-45c4-4900-862d-65019478e239', 'products/257ed2d0-8985-4324-b996-dc8611a3626c/e21cbf93-87c6-4517-9a23-b869ed548ef6.webp', 2),
  ('f05b9221-82fe-404f-886d-a5e8ffc8a31c', 'women-pants', '팬츠', '3522c0db-45c4-4900-862d-65019478e239', 'products/c1bd102f-aba2-408d-b4b8-8a4a67fc2e6c/22afd745-e32d-4982-8c4f-5a2a65352564.webp', 3),
  ('756e371c-6942-4b88-88f2-c14609cd7850', 'women-dresses', '드레스', '3522c0db-45c4-4900-862d-65019478e239', 'products/7dd1d6ac-9d2f-4c33-87f2-54ba630a2ae3/8b30db43-3ce5-4797-8f28-3a7620e15177.webp', 4),
  ('c49f5e98-a4bc-45c6-8a17-4286a7ce396a', 'men-outerwear', '아우터', '475178f9-197d-41eb-907a-892c1710a711', 'products/76f8ccef-c877-4294-8e1a-fbee7e4cd361/d1f74857-e37d-46ec-a6c2-86c64e5bdb87.webp', 0),
  ('cc0f30d7-2d5b-4343-9895-64977c39ab87', 'men-knitwear', '니트', '475178f9-197d-41eb-907a-892c1710a711', 'products/0fcdd9f7-f16b-46d4-9d1d-04f4a6bbfdbe/4d3acfb0-48bd-4b0c-addc-42784701a043.webp', 1),
  ('9d191b03-9594-4ef3-9a1b-5997c38537d0', 'men-shirts', '셔츠', '475178f9-197d-41eb-907a-892c1710a711', 'products/fcde9e4b-b871-44b9-919b-b1d0c5bbe610/90c291a0-9e39-4974-9bb3-83650089734d.webp', 2),
  ('770ae031-4fc9-48b4-b0fb-3b1ae72c87ea', 'men-pants', '팬츠', '475178f9-197d-41eb-907a-892c1710a711', 'products/1bd262dc-2445-439e-a168-c51b16d76778/af6ef0e8-d034-4573-8bba-3bf86c47e447.webp', 3),
  ('da70ff68-b0b9-4e48-ae75-f136cfbc314a', 'bags', '가방', '650be103-ef2c-4901-a0a3-331da87adde0', 'products/ff852101-ab0c-431e-bcad-22ac716ac50e/fde89ef6-3918-4848-b2ae-1d5be4f8353e.webp', 0),
  ('1098d638-2d89-4757-b35c-07f7ae23ba90', 'belts', '벨트', '650be103-ef2c-4901-a0a3-331da87adde0', 'products/0a49d6f3-3e4a-4cc9-ad90-14e007816023/6d938da6-a8cc-4115-a430-2379cdc95f0e.webp', 1);

insert into public.products (id, slug, name, description, material, care, price, compare_at_price, category_id, status, is_featured, published_at, created_at)
values
  ('2b83f8e4-52d6-4437-9a1e-8f3914d61f97', 'oversized-wool-blazer', '오버사이즈 울 블레이저', '어깨선을 내린 오버사이즈 핏의 싱글 브레스트 블레이저.
노치드 라펠, 투 버튼 여밈, 플랩 포켓 2개, 뒤트임 1개.
모델 키 172cm, S 착용.
총장 S 76 / M 78 / L 80cm · 가슴단면 S 56 / M 58 / L 60cm', '겉감 울 70%, 폴리에스터 30%
안감 큐프라 100%', '드라이클리닝
다림질은 낮은 온도에서 천을 덧대어 주세요.', 329000, null, 'ad0de5f6-dcaa-499c-8ce7-26cea17397c5', 'active', true, now() - interval '3 days', now() - interval '3 days'),
  ('36c3de4f-7960-4d92-8dfb-5137f246e553', 'cotton-gabardine-trench-coat', '코튼 개버딘 트렌치 코트', '촘촘한 개버딘 조직의 더블 브레스트 트렌치 코트.
허리 벨트와 소매 스트랩 포함, 래글런 소매, 무릎 아래 기장.
모델 키 170cm, S 착용.
총장 S 112 / M 114 / L 116cm', '겉감 면 100%
안감 폴리에스터 100%', '드라이클리닝
표백 금지', 389000, 429000, 'ad0de5f6-dcaa-499c-8ce7-26cea17397c5', 'active', false, now() - interval '6 days', now() - interval '6 days'),
  ('919a4d80-fa82-4aa9-893c-9a95d89c0989', 'merino-turtleneck-knit', '메리노 터틀넥 니트', '몸에 가깝게 맞는 슬림 핏 터틀넥.
18게이지 고밀도 편직으로 얇고 가볍습니다.
모델 키 171cm, S 착용.
총장 S 58 / M 60 / L 62cm', '엑스트라 파인 메리노 울 100%', '울 전용 세제로 찬물 손세탁
뉘어서 건조', 159000, null, '2da275ce-f57f-41cb-9e4f-daf80bbc8770', 'active', true, now() - interval '2 days', now() - interval '2 days'),
  ('6834aa91-7f15-4c6f-ad5c-a4fa456f481a', 'mohair-blend-knit', '모헤어 블렌드 니트', '드롭 숄더의 박시한 크루넥 니트.
모헤어 혼방 원사를 성기게 짜 부피감은 있고 무게는 가볍습니다.
총장 S 60 / M 62 / L 64cm · 가슴단면 S 58 / M 60 / L 62cm', '모헤어 46%, 폴리아미드 30%, 울 24%', '드라이클리닝
보풀이 생기면 니트 전용 브러시를 사용하세요.', 189000, null, '2da275ce-f57f-41cb-9e4f-daf80bbc8770', 'active', false, now() - interval '9 days', now() - interval '9 days'),
  ('257ed2d0-8985-4324-b996-dc8611a3626c', 'oversized-cotton-shirt', '오버사이즈 코튼 셔츠', '넉넉한 품의 포플린 셔츠.
숨은 단추 여밈, 라운드 밑단, 뒤 요크 주름.
모델 키 173cm, S 착용.
총장 S 78 / M 80 / L 82cm', '면 100%', '30°C 이하 세탁기 세탁
중간 온도 다림질', 119000, null, 'fb36e49d-f7b0-458c-baf4-46ef0cf57ed4', 'active', true, now() - interval '1 days', now() - interval '1 days'),
  ('c1bd102f-aba2-408d-b4b8-8a4a67fc2e6c', 'wide-wool-trousers', '와이드 울 트라우저', '하이 웨이스트, 앞주름 2개의 와이드 트라우저.
밑단까지 일자로 떨어지며 바닥에 닿지 않는 기장입니다.
허리 S 66 / M 70 / L 74cm · 총장 S 104 / M 105 / L 106cm', '울 98%, 엘라스테인 2%
주머니감 면 100%', '드라이클리닝', 219000, null, 'f05b9221-82fe-404f-886d-a5e8ffc8a31c', 'active', false, now() - interval '5 days', now() - interval '5 days'),
  ('7dd1d6ac-9d2f-4c33-87f2-54ba630a2ae3', 'silk-slip-dress', '실크 슬립 드레스', '바이어스 재단으로 몸선을 따라 흐르는 슬립 드레스.
가는 스트랩은 길이 조절 가능, 발목 위 기장.
총장 S 118 / M 120 / L 122cm', '실크 100%', '드라이클리닝
직사광선을 피해 보관', 279000, null, '756e371c-6942-4b88-88f2-c14609cd7850', 'active', false, now() - interval '12 days', now() - interval '12 days'),
  ('76f8ccef-c877-4294-8e1a-fbee7e4cd361', 'wool-cashmere-chester-coat', '울 캐시미어 체스터 코트', '피크드 라펠의 싱글 브레스트 체스터 코트.
어깨 패드를 얇게 넣어 자연스러운 어깨선, 무릎 위 기장.
모델 키 183cm, M 착용.
총장 S 100 / M 102 / L 104cm', '겉감 울 90%, 캐시미어 10%
안감 큐프라 100%', '드라이클리닝', 489000, null, 'c49f5e98-a4bc-45c6-8a17-4286a7ce396a', 'active', true, now() - interval '4 days', now() - interval '4 days'),
  ('98dacfa7-8972-44d9-8e55-a49482a25b64', 'single-breasted-blazer', '싱글 브레스트 블레이저', '언컨스트럭티드 구조의 투 버튼 블레이저.
어깨 패드 없이 반안감으로 가볍게 제작했습니다.
모델 키 182cm, M 착용.
총장 S 74 / M 76 / L 78cm', '겉감 울 100%
안감 큐프라 100%', '드라이클리닝', 359000, null, 'c49f5e98-a4bc-45c6-8a17-4286a7ce396a', 'active', false, now() - interval '8 days', now() - interval '8 days'),
  ('0fcdd9f7-f16b-46d4-9d1d-04f4a6bbfdbe', 'merino-crewneck-knit', '메리노 크루넥 니트', '레귤러 핏 크루넥 니트.
16게이지 편직, 소매와 밑단은 리브 마감.
모델 키 185cm, L 착용.
총장 S 66 / M 68 / L 70cm', '엑스트라 파인 메리노 울 100%', '울 전용 세제로 찬물 손세탁
뉘어서 건조', 149000, null, 'cc0f30d7-2d5b-4343-9895-64977c39ab87', 'active', true, now() - interval '2 days', now() - interval '2 days'),
  ('fcde9e4b-b871-44b9-919b-b1d0c5bbe610', 'linen-henley-shirt', '린넨 헨리넥 셔츠', '밴드 칼라에 반 여밈 버튼의 헨리넥 반소매 셔츠.
워싱 가공으로 처음부터 부드럽습니다.
총장 S 70 / M 72 / L 74cm', '린넨 100%', '30°C 이하 단독 세탁
세탁 후 형태를 잡아 그늘 건조', 99000, null, '9d191b03-9594-4ef3-9a1b-5997c38537d0', 'active', false, now() - interval '20 days', now() - interval '20 days'),
  ('26ace749-dc1e-44b4-ae34-d7911d144d14', 'linen-short-sleeve-shirt', '린넨 반소매 셔츠', '밴드 칼라의 박시한 반소매 셔츠.
가슴 포켓 없이 단순하게 마무리했습니다.
총장 S 70 / M 72 / L 74cm · 가슴단면 S 56 / M 58 / L 60cm', '린넨 100%', '30°C 이하 단독 세탁
세탁 후 형태를 잡아 그늘 건조', 89000, 109000, '9d191b03-9594-4ef3-9a1b-5997c38537d0', 'active', false, now() - interval '15 days', now() - interval '15 days'),
  ('1bd262dc-2445-439e-a168-c51b16d76778', 'cotton-twill-trousers', '코튼 트윌 트라우저', '테이퍼드 핏의 치노 트라우저.
안쪽 허리 밴드에 실리콘 테이프를 덧대 셔츠가 빠지지 않습니다.
허리 S 78 / M 82 / L 86cm · 총장 S 100 / M 102 / L 104cm', '면 98%, 엘라스테인 2%', '30°C 이하 세탁기 세탁
뒤집어서 건조', 139000, null, '770ae031-4fc9-48b4-b0fb-3b1ae72c87ea', 'active', false, now() - interval '10 days', now() - interval '10 days'),
  ('ff852101-ab0c-431e-bcad-22ac716ac50e', 'leather-tote-bag', '레더 토트백', '베지터블 태닝 소가죽 토트백.
내부 지퍼 포켓 1개, 마그네틱 여밈.
가로 38 × 세로 34 × 폭 12cm · 손잡이 높이 24cm', '소가죽 100%
안감 면 100%', '물기와 직사광선을 피해 보관
오염 시 마른 천으로 닦아 주세요.', 349000, null, 'da70ff68-b0b9-4e48-ae75-f136cfbc314a', 'active', true, now() - interval '7 days', now() - interval '7 days'),
  ('31c61706-564a-49f8-9e0d-040d4e025935', 'leather-shoulder-bag', '레더 숄더백', '부드러운 램스킨의 슬라우치 숄더백.
상단 지퍼 여밈, 내부 오픈 포켓 1개.
가로 40 × 세로 22 × 폭 14cm · 스트랩 길이 56cm', '양가죽 100%
안감 폴리에스터 100%', '물기와 직사광선을 피해 보관
오염 시 마른 천으로 닦아 주세요.', 289000, null, 'da70ff68-b0b9-4e48-ae75-f136cfbc314a', 'active', false, now() - interval '11 days', now() - interval '11 days'),
  ('0a49d6f3-3e4a-4cc9-ad90-14e007816023', 'leather-belt', '레더 벨트', '폭 3cm의 소가죽 벨트, 무광 실버 버클.
85 / 90 / 95는 착용 허리둘레(cm) 기준이며 5개의 구멍 간격은 2.5cm입니다.', '소가죽 100%
버클 황동, 니켈 도금', '물기를 피해 보관', 59000, null, '1098d638-2d89-4757-b35c-07f7ae23ba90', 'active', false, now() - interval '14 days', now() - interval '14 days');

insert into public.product_images (id, product_id, storage_path, alt, color, sort)
values
  ('3611102d-a7ff-4a04-9a13-06ee6a6c9c96', '2b83f8e4-52d6-4437-9a1e-8f3914d61f97', 'products/2b83f8e4-52d6-4437-9a1e-8f3914d61f97/3611102d-a7ff-4a04-9a13-06ee6a6c9c96.webp', '오버사이즈 울 블레이저, Black', 'Black', 0),
  ('7a009f4b-5432-45f7-a5fa-446fc1b3ceb8', '2b83f8e4-52d6-4437-9a1e-8f3914d61f97', 'products/2b83f8e4-52d6-4437-9a1e-8f3914d61f97/7a009f4b-5432-45f7-a5fa-446fc1b3ceb8.webp', '오버사이즈 울 블레이저, Black', 'Black', 1),
  ('b4214e2e-95f9-474d-b156-878761d2f62c', '36c3de4f-7960-4d92-8dfb-5137f246e553', 'products/36c3de4f-7960-4d92-8dfb-5137f246e553/b4214e2e-95f9-474d-b156-878761d2f62c.webp', '코튼 개버딘 트렌치 코트, Beige', 'Beige', 0),
  ('2bd4166b-0dcb-4ff3-815d-d90e7d581753', '36c3de4f-7960-4d92-8dfb-5137f246e553', 'products/36c3de4f-7960-4d92-8dfb-5137f246e553/2bd4166b-0dcb-4ff3-815d-d90e7d581753.webp', '코튼 개버딘 트렌치 코트, Black', 'Black', 1),
  ('fff22d97-0257-4984-b9dc-2373692ede7c', '919a4d80-fa82-4aa9-893c-9a95d89c0989', 'products/919a4d80-fa82-4aa9-893c-9a95d89c0989/fff22d97-0257-4984-b9dc-2373692ede7c.webp', '메리노 터틀넥 니트, Black', 'Black', 0),
  ('1cea9d2e-5776-4bb7-b3c4-369620361c5a', '919a4d80-fa82-4aa9-893c-9a95d89c0989', 'products/919a4d80-fa82-4aa9-893c-9a95d89c0989/1cea9d2e-5776-4bb7-b3c4-369620361c5a.webp', '메리노 터틀넥 니트, Black', 'Black', 1),
  ('94d8436d-cf41-47b4-89e2-bda0858e2204', '6834aa91-7f15-4c6f-ad5c-a4fa456f481a', 'products/6834aa91-7f15-4c6f-ad5c-a4fa456f481a/94d8436d-cf41-47b4-89e2-bda0858e2204.webp', '모헤어 블렌드 니트, Ivory', 'Ivory', 0),
  ('466c816f-de60-4f1b-ad88-4a52881b6ff9', '6834aa91-7f15-4c6f-ad5c-a4fa456f481a', 'products/6834aa91-7f15-4c6f-ad5c-a4fa456f481a/466c816f-de60-4f1b-ad88-4a52881b6ff9.webp', '모헤어 블렌드 니트, Ivory', 'Ivory', 1),
  ('e21cbf93-87c6-4517-9a23-b869ed548ef6', '257ed2d0-8985-4324-b996-dc8611a3626c', 'products/257ed2d0-8985-4324-b996-dc8611a3626c/e21cbf93-87c6-4517-9a23-b869ed548ef6.webp', '오버사이즈 코튼 셔츠, White', 'White', 0),
  ('abd7fc2c-4bcf-4de7-beb3-538b1b018462', '257ed2d0-8985-4324-b996-dc8611a3626c', 'products/257ed2d0-8985-4324-b996-dc8611a3626c/abd7fc2c-4bcf-4de7-beb3-538b1b018462.webp', '오버사이즈 코튼 셔츠, White', 'White', 1),
  ('22afd745-e32d-4982-8c4f-5a2a65352564', 'c1bd102f-aba2-408d-b4b8-8a4a67fc2e6c', 'products/c1bd102f-aba2-408d-b4b8-8a4a67fc2e6c/22afd745-e32d-4982-8c4f-5a2a65352564.webp', '와이드 울 트라우저, Black', 'Black', 0),
  ('a0426a8b-8859-4a06-a3c5-664c1812bd02', 'c1bd102f-aba2-408d-b4b8-8a4a67fc2e6c', 'products/c1bd102f-aba2-408d-b4b8-8a4a67fc2e6c/a0426a8b-8859-4a06-a3c5-664c1812bd02.webp', '와이드 울 트라우저, Grey', 'Grey', 1),
  ('8b30db43-3ce5-4797-8f28-3a7620e15177', '7dd1d6ac-9d2f-4c33-87f2-54ba630a2ae3', 'products/7dd1d6ac-9d2f-4c33-87f2-54ba630a2ae3/8b30db43-3ce5-4797-8f28-3a7620e15177.webp', '실크 슬립 드레스, Black', 'Black', 0),
  ('a27dd4dd-474b-472c-a8b3-be3bc4e1d228', '7dd1d6ac-9d2f-4c33-87f2-54ba630a2ae3', 'products/7dd1d6ac-9d2f-4c33-87f2-54ba630a2ae3/a27dd4dd-474b-472c-a8b3-be3bc4e1d228.webp', '실크 슬립 드레스, Ivory', 'Ivory', 1),
  ('8b72f5bd-7613-4a34-b302-c634d5ceb829', '7dd1d6ac-9d2f-4c33-87f2-54ba630a2ae3', 'products/7dd1d6ac-9d2f-4c33-87f2-54ba630a2ae3/8b72f5bd-7613-4a34-b302-c634d5ceb829.webp', '실크 슬립 드레스, Black', 'Black', 2),
  ('d1f74857-e37d-46ec-a6c2-86c64e5bdb87', '76f8ccef-c877-4294-8e1a-fbee7e4cd361', 'products/76f8ccef-c877-4294-8e1a-fbee7e4cd361/d1f74857-e37d-46ec-a6c2-86c64e5bdb87.webp', '울 캐시미어 체스터 코트, Grey', 'Grey', 0),
  ('aa9437e3-ec6d-47c3-b466-4085e12a2cf8', '76f8ccef-c877-4294-8e1a-fbee7e4cd361', 'products/76f8ccef-c877-4294-8e1a-fbee7e4cd361/aa9437e3-ec6d-47c3-b466-4085e12a2cf8.webp', '울 캐시미어 체스터 코트, Grey', 'Grey', 1),
  ('39b6b688-c77c-4e27-a0b5-434d100a09f2', '98dacfa7-8972-44d9-8e55-a49482a25b64', 'products/98dacfa7-8972-44d9-8e55-a49482a25b64/39b6b688-c77c-4e27-a0b5-434d100a09f2.webp', '싱글 브레스트 블레이저, Black', 'Black', 0),
  ('a6dfb598-c9e3-4e6d-aaa1-4ebfe6c3094d', '98dacfa7-8972-44d9-8e55-a49482a25b64', 'products/98dacfa7-8972-44d9-8e55-a49482a25b64/a6dfb598-c9e3-4e6d-aaa1-4ebfe6c3094d.webp', '싱글 브레스트 블레이저, Black', 'Black', 1),
  ('b1520197-93a2-42ac-9145-2fd9a147d2d9', '98dacfa7-8972-44d9-8e55-a49482a25b64', 'products/98dacfa7-8972-44d9-8e55-a49482a25b64/b1520197-93a2-42ac-9145-2fd9a147d2d9.webp', '싱글 브레스트 블레이저, Black', 'Black', 2),
  ('4d3acfb0-48bd-4b0c-addc-42784701a043', '0fcdd9f7-f16b-46d4-9d1d-04f4a6bbfdbe', 'products/0fcdd9f7-f16b-46d4-9d1d-04f4a6bbfdbe/4d3acfb0-48bd-4b0c-addc-42784701a043.webp', '메리노 크루넥 니트, Black', 'Black', 0),
  ('94d2c085-332f-48f2-81aa-80c88d6bb725', '0fcdd9f7-f16b-46d4-9d1d-04f4a6bbfdbe', 'products/0fcdd9f7-f16b-46d4-9d1d-04f4a6bbfdbe/94d2c085-332f-48f2-81aa-80c88d6bb725.webp', '메리노 크루넥 니트, Black', 'Black', 1),
  ('4149bc11-7e30-42b8-9d96-afa7dc0baced', '0fcdd9f7-f16b-46d4-9d1d-04f4a6bbfdbe', 'products/0fcdd9f7-f16b-46d4-9d1d-04f4a6bbfdbe/4149bc11-7e30-42b8-9d96-afa7dc0baced.webp', '메리노 크루넥 니트, Black', 'Black', 2),
  ('90c291a0-9e39-4974-9bb3-83650089734d', 'fcde9e4b-b871-44b9-919b-b1d0c5bbe610', 'products/fcde9e4b-b871-44b9-919b-b1d0c5bbe610/90c291a0-9e39-4974-9bb3-83650089734d.webp', '린넨 헨리넥 셔츠, White', 'White', 0),
  ('90dce5e1-918c-4909-b2cc-11304845a7ea', 'fcde9e4b-b871-44b9-919b-b1d0c5bbe610', 'products/fcde9e4b-b871-44b9-919b-b1d0c5bbe610/90dce5e1-918c-4909-b2cc-11304845a7ea.webp', '린넨 헨리넥 셔츠, White', 'White', 1),
  ('74d481bc-ef55-4b0f-8b7c-c3999572e6e6', '26ace749-dc1e-44b4-ae34-d7911d144d14', 'products/26ace749-dc1e-44b4-ae34-d7911d144d14/74d481bc-ef55-4b0f-8b7c-c3999572e6e6.webp', '린넨 반소매 셔츠, Light Grey', 'Light Grey', 0),
  ('45f95f0e-458e-439c-936b-5d3d140a4198', '26ace749-dc1e-44b4-ae34-d7911d144d14', 'products/26ace749-dc1e-44b4-ae34-d7911d144d14/45f95f0e-458e-439c-936b-5d3d140a4198.webp', '린넨 반소매 셔츠, Navy', 'Navy', 1),
  ('af6ef0e8-d034-4573-8bba-3bf86c47e447', '1bd262dc-2445-439e-a168-c51b16d76778', 'products/1bd262dc-2445-439e-a168-c51b16d76778/af6ef0e8-d034-4573-8bba-3bf86c47e447.webp', '코튼 트윌 트라우저, Beige', 'Beige', 0),
  ('991da8c3-4816-476a-b096-951bd107b549', '1bd262dc-2445-439e-a168-c51b16d76778', 'products/1bd262dc-2445-439e-a168-c51b16d76778/991da8c3-4816-476a-b096-951bd107b549.webp', '코튼 트윌 트라우저, Off White', 'Off White', 1),
  ('fde89ef6-3918-4848-b2ae-1d5be4f8353e', 'ff852101-ab0c-431e-bcad-22ac716ac50e', 'products/ff852101-ab0c-431e-bcad-22ac716ac50e/fde89ef6-3918-4848-b2ae-1d5be4f8353e.webp', '레더 토트백, Tan', 'Tan', 0),
  ('7ef6314c-f42f-4635-88ba-982bc9ba31eb', 'ff852101-ab0c-431e-bcad-22ac716ac50e', 'products/ff852101-ab0c-431e-bcad-22ac716ac50e/7ef6314c-f42f-4635-88ba-982bc9ba31eb.webp', '레더 토트백, Tan', 'Tan', 1),
  ('f0552550-a8f1-4dfe-9fe6-0f3661f58a19', '31c61706-564a-49f8-9e0d-040d4e025935', 'products/31c61706-564a-49f8-9e0d-040d4e025935/f0552550-a8f1-4dfe-9fe6-0f3661f58a19.webp', '레더 숄더백, Black', 'Black', 0),
  ('155dbd9d-0cea-4ae3-9034-3a73ca54dc15', '31c61706-564a-49f8-9e0d-040d4e025935', 'products/31c61706-564a-49f8-9e0d-040d4e025935/155dbd9d-0cea-4ae3-9034-3a73ca54dc15.webp', '레더 숄더백, Black', 'Black', 1),
  ('6d938da6-a8cc-4115-a430-2379cdc95f0e', '0a49d6f3-3e4a-4cc9-ad90-14e007816023', 'products/0a49d6f3-3e4a-4cc9-ad90-14e007816023/6d938da6-a8cc-4115-a430-2379cdc95f0e.webp', '레더 벨트, Brown', 'Brown', 0),
  ('1425a62d-21a8-4ea5-a96c-6ca91143778e', '0a49d6f3-3e4a-4cc9-ad90-14e007816023', 'products/0a49d6f3-3e4a-4cc9-ad90-14e007816023/1425a62d-21a8-4ea5-a96c-6ca91143778e.webp', '레더 벨트, Tan', 'Tan', 1);

insert into public.product_variants (id, product_id, sku, color, size, stock, sort)
values
  ('62b3068c-1ded-4c78-8642-a32dee49973f', '2b83f8e4-52d6-4437-9a1e-8f3914d61f97', 'DA-WBL-BLA-S', 'Black', 'S', 6, 0),
  ('6579f4ff-3ecd-4fad-9933-628ece5d8c08', '2b83f8e4-52d6-4437-9a1e-8f3914d61f97', 'DA-WBL-BLA-M', 'Black', 'M', 8, 1),
  ('4dd0c779-c93f-4a30-8078-c67b09d0b7be', '2b83f8e4-52d6-4437-9a1e-8f3914d61f97', 'DA-WBL-BLA-L', 'Black', 'L', 4, 2),
  ('97405727-52df-4f53-9b7b-faf3334d76d4', '36c3de4f-7960-4d92-8dfb-5137f246e553', 'DA-WTR-BEI-S', 'Beige', 'S', 5, 0),
  ('bb66224e-60c9-4203-b90c-e855a71c272d', '36c3de4f-7960-4d92-8dfb-5137f246e553', 'DA-WTR-BEI-M', 'Beige', 'M', 2, 1),
  ('6308c38c-eb5f-4bf7-94c1-31aa688707ff', '36c3de4f-7960-4d92-8dfb-5137f246e553', 'DA-WTR-BEI-L', 'Beige', 'L', 0, 2),
  ('9d1db6cb-faac-4d89-b645-323d2666f4fd', '36c3de4f-7960-4d92-8dfb-5137f246e553', 'DA-WTR-BLA-S', 'Black', 'S', 4, 3),
  ('5b9f3bf0-fc91-4cd7-b1f3-470a93701e3a', '36c3de4f-7960-4d92-8dfb-5137f246e553', 'DA-WTR-BLA-M', 'Black', 'M', 6, 4),
  ('8326251b-cfac-4586-84f4-3265de5f2414', '36c3de4f-7960-4d92-8dfb-5137f246e553', 'DA-WTR-BLA-L', 'Black', 'L', 3, 5),
  ('11fc407e-b779-4c8e-b605-c3c6e6acba65', '919a4d80-fa82-4aa9-893c-9a95d89c0989', 'DA-WTN-BLA-S', 'Black', 'S', 10, 0),
  ('1897b071-d7e8-4681-965d-dc198e1c1e9b', '919a4d80-fa82-4aa9-893c-9a95d89c0989', 'DA-WTN-BLA-M', 'Black', 'M', 12, 1),
  ('cfc73f70-87c2-4785-ae30-aaa729931d85', '919a4d80-fa82-4aa9-893c-9a95d89c0989', 'DA-WTN-BLA-L', 'Black', 'L', 2, 2),
  ('cc28ea26-2fc0-4c68-82a5-e67756ebcb8a', '6834aa91-7f15-4c6f-ad5c-a4fa456f481a', 'DA-WMH-IVO-S', 'Ivory', 'S', 7, 0),
  ('d78dfd55-8e48-4308-a7c2-e3631da8eb36', '6834aa91-7f15-4c6f-ad5c-a4fa456f481a', 'DA-WMH-IVO-M', 'Ivory', 'M', 0, 1),
  ('6b8eff0f-bbec-4fea-8148-6d4fa100917e', '6834aa91-7f15-4c6f-ad5c-a4fa456f481a', 'DA-WMH-IVO-L', 'Ivory', 'L', 5, 2),
  ('fa11c3fc-c82f-4db9-aae7-ccdce7fc1d17', '257ed2d0-8985-4324-b996-dc8611a3626c', 'DA-WSH-WHI-S', 'White', 'S', 12, 0),
  ('cb884395-2962-4dc8-9fba-607174042d4f', '257ed2d0-8985-4324-b996-dc8611a3626c', 'DA-WSH-WHI-M', 'White', 'M', 9, 1),
  ('c51dd43a-5661-436d-abcc-01625cb2cca9', '257ed2d0-8985-4324-b996-dc8611a3626c', 'DA-WSH-WHI-L', 'White', 'L', 6, 2),
  ('8a8636a4-dfff-4eb2-9585-fa87ee8fc82f', 'c1bd102f-aba2-408d-b4b8-8a4a67fc2e6c', 'DA-WTS-BLA-S', 'Black', 'S', 6, 0),
  ('c3c1db67-2eff-4c14-89a5-14859e885b35', 'c1bd102f-aba2-408d-b4b8-8a4a67fc2e6c', 'DA-WTS-BLA-M', 'Black', 'M', 7, 1),
  ('66babf45-34c3-47f2-bf26-091ef54ae398', 'c1bd102f-aba2-408d-b4b8-8a4a67fc2e6c', 'DA-WTS-BLA-L', 'Black', 'L', 3, 2),
  ('eca9bdbe-04a1-4e0d-b7d2-a802835ea1f7', 'c1bd102f-aba2-408d-b4b8-8a4a67fc2e6c', 'DA-WTS-GRE-S', 'Grey', 'S', 2, 3),
  ('9697a9b7-fb17-4e61-9f1e-aa7a8a8f1b19', 'c1bd102f-aba2-408d-b4b8-8a4a67fc2e6c', 'DA-WTS-GRE-M', 'Grey', 'M', 4, 4),
  ('b8fa2aa0-470b-4773-b147-9e5158291a30', 'c1bd102f-aba2-408d-b4b8-8a4a67fc2e6c', 'DA-WTS-GRE-L', 'Grey', 'L', 0, 5),
  ('e925651a-8258-41c8-88c3-badc75ab1838', '7dd1d6ac-9d2f-4c33-87f2-54ba630a2ae3', 'DA-WDR-BLA-S', 'Black', 'S', 3, 0),
  ('4b0caecc-0e86-4701-a7ac-f1f28a523780', '7dd1d6ac-9d2f-4c33-87f2-54ba630a2ae3', 'DA-WDR-BLA-M', 'Black', 'M', 5, 1),
  ('11cfba80-4dd3-4adf-9594-9bca1d215ffe', '7dd1d6ac-9d2f-4c33-87f2-54ba630a2ae3', 'DA-WDR-BLA-L', 'Black', 'L', 2, 2),
  ('ed6f1c80-5c43-4bc3-ae1a-3db2d6a62c08', '7dd1d6ac-9d2f-4c33-87f2-54ba630a2ae3', 'DA-WDR-IVO-S', 'Ivory', 'S', 4, 3),
  ('7d59dbb7-c3ee-41d8-a1d6-90b6869a4845', '7dd1d6ac-9d2f-4c33-87f2-54ba630a2ae3', 'DA-WDR-IVO-M', 'Ivory', 'M', 0, 4),
  ('456a75d6-8fdf-4b8d-8c64-620e76a20c09', '7dd1d6ac-9d2f-4c33-87f2-54ba630a2ae3', 'DA-WDR-IVO-L', 'Ivory', 'L', 1, 5),
  ('43cecc84-d09e-4567-aa6a-53e616195cf3', '76f8ccef-c877-4294-8e1a-fbee7e4cd361', 'DA-MCC-GRE-S', 'Grey', 'S', 3, 0),
  ('4adf758d-cae6-46ab-82ee-0e6cf229d317', '76f8ccef-c877-4294-8e1a-fbee7e4cd361', 'DA-MCC-GRE-M', 'Grey', 'M', 5, 1),
  ('aa1f29b8-0cc2-4361-985b-907d54851cb4', '76f8ccef-c877-4294-8e1a-fbee7e4cd361', 'DA-MCC-GRE-L', 'Grey', 'L', 4, 2),
  ('b75d7a1b-f828-4b0a-aa89-c390563b0ca2', '98dacfa7-8972-44d9-8e55-a49482a25b64', 'DA-MBZ-BLA-S', 'Black', 'S', 4, 0),
  ('5177e9cc-7a32-4fad-870e-cc5d31317fc7', '98dacfa7-8972-44d9-8e55-a49482a25b64', 'DA-MBZ-BLA-M', 'Black', 'M', 6, 1),
  ('197fa306-3dce-43ea-aab8-e573a34e5dd9', '98dacfa7-8972-44d9-8e55-a49482a25b64', 'DA-MBZ-BLA-L', 'Black', 'L', 2, 2),
  ('1974790e-a8de-463e-b47b-2ad7c9c69f19', '0fcdd9f7-f16b-46d4-9d1d-04f4a6bbfdbe', 'DA-MKN-BLA-S', 'Black', 'S', 9, 0),
  ('c170cc63-d2bb-43a5-ad9a-c3b50784f13f', '0fcdd9f7-f16b-46d4-9d1d-04f4a6bbfdbe', 'DA-MKN-BLA-M', 'Black', 'M', 11, 1),
  ('33d8a7a3-ad16-4f2c-809d-1f9e00289e92', '0fcdd9f7-f16b-46d4-9d1d-04f4a6bbfdbe', 'DA-MKN-BLA-L', 'Black', 'L', 7, 2),
  ('0b856ff5-f7f2-4c06-ad30-cb7478e70f3e', 'fcde9e4b-b871-44b9-919b-b1d0c5bbe610', 'DA-MHN-WHI-S', 'White', 'S', 0, 0),
  ('ce8140c9-9ff2-4202-8d22-43196e279962', 'fcde9e4b-b871-44b9-919b-b1d0c5bbe610', 'DA-MHN-WHI-M', 'White', 'M', 0, 1),
  ('569a0cea-e43d-4dcc-9f36-e40ccd063cab', 'fcde9e4b-b871-44b9-919b-b1d0c5bbe610', 'DA-MHN-WHI-L', 'White', 'L', 0, 2),
  ('dfcc3a68-d467-4a2d-be83-df9e2c480d98', '26ace749-dc1e-44b4-ae34-d7911d144d14', 'DA-MSS-LIG-S', 'Light Grey', 'S', 5, 0),
  ('52de2e33-adf5-485b-86e2-b8dfcbffaa80', '26ace749-dc1e-44b4-ae34-d7911d144d14', 'DA-MSS-LIG-M', 'Light Grey', 'M', 8, 1),
  ('be7ce386-91af-4d36-bccf-df148b203068', '26ace749-dc1e-44b4-ae34-d7911d144d14', 'DA-MSS-LIG-L', 'Light Grey', 'L', 2, 2),
  ('b43f9a48-7ddd-4c0b-9268-9b9386a9d692', '26ace749-dc1e-44b4-ae34-d7911d144d14', 'DA-MSS-NAV-S', 'Navy', 'S', 6, 3),
  ('9bfdb881-94f9-42e0-aefc-5022eb30709e', '26ace749-dc1e-44b4-ae34-d7911d144d14', 'DA-MSS-NAV-M', 'Navy', 'M', 3, 4),
  ('dba9b77b-393c-47a1-a997-766c9254dc37', '26ace749-dc1e-44b4-ae34-d7911d144d14', 'DA-MSS-NAV-L', 'Navy', 'L', 0, 5),
  ('851ecd99-083b-4417-944e-0fb2e340e5cb', '1bd262dc-2445-439e-a168-c51b16d76778', 'DA-MTW-BEI-S', 'Beige', 'S', 8, 0),
  ('044f0030-9242-4452-85e8-b912fdff70dd', '1bd262dc-2445-439e-a168-c51b16d76778', 'DA-MTW-BEI-M', 'Beige', 'M', 10, 1),
  ('a416cb97-3bb3-4806-9c7b-740aac78f31c', '1bd262dc-2445-439e-a168-c51b16d76778', 'DA-MTW-BEI-L', 'Beige', 'L', 6, 2),
  ('df8eade4-d5df-4428-b47b-3c9a327ae5bc', '1bd262dc-2445-439e-a168-c51b16d76778', 'DA-MTW-OFF-S', 'Off White', 'S', 5, 3),
  ('36785d16-e798-452e-a9d5-60640f4f45e0', '1bd262dc-2445-439e-a168-c51b16d76778', 'DA-MTW-OFF-M', 'Off White', 'M', 2, 4),
  ('ee253e74-6a0b-4e2c-93d1-34a82cd35759', '1bd262dc-2445-439e-a168-c51b16d76778', 'DA-MTW-OFF-L', 'Off White', 'L', 4, 5),
  ('006e139c-9630-4512-a4ce-3ea31ab9da39', 'ff852101-ab0c-431e-bcad-22ac716ac50e', 'DA-BTT-TAN-OS', 'Tan', 'ONE SIZE', 7, 0),
  ('ea8be901-c0f8-46bf-b1fb-1e96c6dfbe56', '31c61706-564a-49f8-9e0d-040d4e025935', 'DA-BSH-BLA-OS', 'Black', 'ONE SIZE', 2, 0),
  ('b5f8dd7c-cf17-4095-8b14-2fd927ade8dd', '0a49d6f3-3e4a-4cc9-ad90-14e007816023', 'DA-BLT-BRO-85', 'Brown', '85', 6, 0),
  ('97f7a8eb-7ab1-4c90-a8da-1e4f22d92b8c', '0a49d6f3-3e4a-4cc9-ad90-14e007816023', 'DA-BLT-BRO-90', 'Brown', '90', 8, 1),
  ('124327cd-f0fc-4759-aab3-73caab2b5905', '0a49d6f3-3e4a-4cc9-ad90-14e007816023', 'DA-BLT-BRO-95', 'Brown', '95', 5, 2),
  ('7a766f20-8747-4ff8-abf5-6465070ec2a5', '0a49d6f3-3e4a-4cc9-ad90-14e007816023', 'DA-BLT-TAN-85', 'Tan', '85', 0, 3),
  ('6755c56b-7508-4cf1-a24e-92c16eabec63', '0a49d6f3-3e4a-4cc9-ad90-14e007816023', 'DA-BLT-TAN-90', 'Tan', '90', 4, 4),
  ('d6cfd1eb-ac64-40d3-b026-597d2508fc29', '0a49d6f3-3e4a-4cc9-ad90-14e007816023', 'DA-BLT-TAN-95', 'Tan', '95', 3, 5);

-- Home -------------------------------------------------------------------------------------------

insert into public.home_sections (id, kind, title, link_label, link_href, image_path, image_path_2, category_id, items, sort)
values
  ('3a5f75df-c3cf-40cc-ad0d-ffac1138113e', 'hero', 'Autumn Winter 2026', 'Discover', '/shop', 'banners/3a5f75df-c3cf-40cc-ad0d-ffac1138113e/8d560851-456f-4a7e-98f1-d749c9b2cf82.webp', null, null, '[]', 0),
  ('01fbd176-c20b-497b-818d-f3d84b68cacb', 'split', 'Tailoring', 'Shop Now', '/shop/women-outerwear', 'banners/01fbd176-c20b-497b-818d-f3d84b68cacb/f6771178-8cda-45fc-9d8c-afdfefa46c80.webp', 'banners/01fbd176-c20b-497b-818d-f3d84b68cacb/614c5126-7733-4e01-b976-1d8db864da2e.webp', null, '[]', 1),
  ('54703d94-2c84-45b3-b12e-537cf92232d7', 'collection', 'Women', 'View All', '/shop/women', null, null, '3522c0db-45c4-4900-862d-65019478e239', '[]', 2),
  ('4b17b407-b489-4d58-870a-ec8fc6135105', 'collection', 'Men', 'View All', '/shop/men', null, null, '475178f9-197d-41eb-907a-892c1710a711', '[]', 3),
  ('467320ee-6c2c-4178-a7d5-7866bb0f98b8', 'lookbook', 'Lookbook AW26', 'View Lookbook', '/lookbook', null, null, null, '[{"image_path":"banners/467320ee-6c2c-4178-a7d5-7866bb0f98b8/8e6589a3-118c-4469-a1e3-346059e3ce2b.webp","caption":"Look 01","href":"/shop/women-outerwear"},{"image_path":"banners/467320ee-6c2c-4178-a7d5-7866bb0f98b8/1754a5da-725d-442f-a7a4-a1a40e2da95b.webp","caption":"Look 02","href":"/shop/women-dresses"},{"image_path":"banners/467320ee-6c2c-4178-a7d5-7866bb0f98b8/69926abf-6cc6-46d8-bf62-5f163586bba2.webp","caption":"Look 03","href":"/shop/women-pants"},{"image_path":"banners/467320ee-6c2c-4178-a7d5-7866bb0f98b8/0b53a2b5-1f39-4398-927e-b6c09d840f60.webp","caption":"Look 04","href":"/shop/men-outerwear"}]', 4);

-- Seed inserts are not admin activity; start with an empty audit trail.
delete from public.audit_logs;
