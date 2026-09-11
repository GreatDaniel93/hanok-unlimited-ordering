alter table public.menu_items add column if not exists display_name_zh text;
alter table public.menu_items add column if not exists description_zh text;
alter table public.menu_items add column if not exists portion_label_zh text;
alter table public.order_items add column if not exists item_name_zh text;

update public.menu_items set name=coalesce(nullif(display_name,''),name)
where store_id=(select id from public.stores where slug='wagga-wagga');

update public.menu_items set display_name_zh=case display_name
when 'Cheese fried chicken' then '芝士炸鸡'
when 'Chicken schinizel' then '炸鸡排'
when 'Coconut cheese fried chicken' then '椰香芝士炸鸡'
when 'Deep fried noodle sushi' then '炸面寿司'
when 'Korean Fried Chicken - Original' then '原味韩式炸鸡'
when 'Pork cutlet' then '炸猪排'
when 'Potato wedges' then '薯角'
when 'Shallot mustard fried chicken' then '香葱芥末炸鸡'
when 'Soy garlic shallot Fried Chicken' then '酱油蒜香葱炸鸡'
when 'Sweet spicy fried chicken' then '甜辣炸鸡'
when 'Tempura' then '天妇罗'
when 'Fried Dumplings' then '炸饺子'
when 'Seafood Pancake' then '海鲜饼'
when 'Tteokbokki' then '辣炒年糕'
when 'Japchae' then '韩式杂菜'
when 'Korean Rolled Egg' then '韩式鸡蛋卷'
when 'French Fries' then '炸薯条'
when 'Wagyu Scotch Fillet' then '和牛肉眼'
when 'Wagyu Intercostal' then '和牛牛肋条'
when 'Wagyu Inside Skirt' then '和牛内裙肉'
when 'Marinated LA Short Rib' then '腌制LA牛小排'
when 'Marinated Angus Flap Meat' then '腌制安格斯腹肉'
when 'Wagyu Brisket' then '和牛牛五花'
when 'Pork Belly' then '五花肉'
when 'Pork Sausage' then '猪肉香肠'
when 'Spicy Marinated Chicken Thigh' then '辣味腌鸡腿肉'
when 'Fresh scollop' then '鲜扇贝'
when 'Lamb cuttlet' then '羊排'
when 'Marinated pork rib' then '腌制猪肋排'
when 'Marinated short rib' then '腌制牛小排'
when 'OX.tongue' then '牛舌'
when 'Pork jowl' then '猪颈肉'
when 'Soy Marinated Chicken Thigh' then '酱油腌鸡腿肉'
when 'Wagyu outer flap' then '和牛外腹肉'
when 'Spicy Squid' then '辣味鱿鱼'
when 'Steamed Rice' then '米饭'
when 'Dolsot Bibimbap' then '石锅拌饭'
when 'Soup of the Day' then '每日例汤'
else coalesce(display_name_zh,display_name) end,
portion_label_zh=case portion_label
when '50g / order' then '每份50g'
when '100g / order' then '每份100g'
when '150g / order' then '每份150g'
when '50g/ order' then '每份50g'
when 'Small sharing portion' then '小份分享装'
when '2pieces' then '2块'
when '4 slices' then '4片'
when '1 bowl' then '1碗'
when '1 small stone bowl' then '1小石锅'
when '1 small bowl' then '1小碗'
else coalesce(portion_label_zh,portion_label) end
where store_id=(select id from public.stores where slug='wagga-wagga');

-- Live RPC definitions are updated by the production migration. This repository migration records the schema/data additions; RPCs are kept in the live database and should include the bilingual fields in manager_get_menu, manager_menu_action, get_customer_context, add_starter_order_v2, submit_customer_order and print_get_pending_v2.
