from pathlib import Path

bridge = Path('app/src/main/java/com/hanok/printbridge/BridgeService.java')
text = bridge.read_text(encoding='utf-8')
old = 'header(b,o.optString("table_name","TABLE"),sec,type);items(b,its);footer(b,count,o.optString("created_at",""));return b.toByteArray();'
new = 'if(station.equals("hot")){String typeZh=source.equals("starter")?"首轮拼盘":(o.optInt("round_no",0)>0?"第 "+o.optInt("round_no")+" 轮":"新订单");header(b,o.optString("table_name","TABLE"),"热菜厨房",typeZh);itemsZh(b,its);footerZh(b,count,o.optString("created_at",""));}else{header(b,o.optString("table_name","TABLE"),sec,type);items(b,its);footer(b,count,o.optString("created_at",""));}return b.toByteArray();'
if old not in text:
    raise SystemExit('BridgeService station ticket anchor not found')
text = text.replace(old, new, 1)
anchor = '    private void items(ByteArrayOutputStream b,List<JSONObject> list)throws Exception{for(JSONObject it:list){String name=it.optString("item_name","Item");int qty=it.optInt("qty",0);write(b,new byte[]{0x1b,0x45,0x01,0x1d,0x21,0x01});txt(b,itemLine(name,qty));txt(b,"\\n");write(b,new byte[]{0x1d,0x21,0x00,0x1b,0x45,0x00});}}\n'
insert = anchor + '    private void itemsZh(ByteArrayOutputStream b,List<JSONObject> list)throws Exception{for(JSONObject it:list){String name=it.optString("item_name_zh",it.optString("item_name","菜品"));int qty=it.optInt("qty",0);write(b,new byte[]{0x1b,0x45,0x01,0x1d,0x21,0x01});txt(b,name+"  ×"+qty+"\\n\\n");write(b,new byte[]{0x1d,0x21,0x00,0x1b,0x45,0x00});}}\n'
if anchor not in text:
    raise SystemExit('BridgeService items anchor not found')
text = text.replace(anchor, insert, 1)
footer_anchor = '    private void footer(ByteArrayOutputStream b,int count,String created)throws Exception{String time=created.length()>15?created.substring(11,16):"";write(b,new byte[]{0x1b,0x45,0x00,0x1d,0x21,0x00});txt(b,"------------------------------------------\\n");write(b,new byte[]{0x1b,0x45,0x01});String left="ITEMS: "+count,right=time;StringBuilder row=new StringBuilder(left);while(row.length()<42-right.length())row.append(\' \');row.append(right).append(\'\\n\');txt(b,row.toString());write(b,new byte[]{0x1b,0x45,0x00});txt(b,"==========================================\\n");}\n'
footer_insert = footer_anchor + '    private void footerZh(ByteArrayOutputStream b,int count,String created)throws Exception{String time=created.length()>15?created.substring(11,16):"";write(b,new byte[]{0x1b,0x45,0x00,0x1d,0x21,0x00});txt(b,"------------------------------------------\\n");write(b,new byte[]{0x1b,0x45,0x01});txt(b,"总份数："+count+"    "+time+"\\n");write(b,new byte[]{0x1b,0x45,0x00});txt(b,"==========================================\\n");}\n'
if footer_anchor not in text:
    raise SystemExit('BridgeService footer anchor not found')
text = text.replace(footer_anchor, footer_insert, 1)
bridge.write_text(text, encoding='utf-8')

main = Path('app/src/main/java/com/hanok/printbridge/MainActivity.java')
m = main.read_text(encoding='utf-8').replace('v1.9','v1.10')
main.write_text(m, encoding='utf-8')
print('Applied bilingual HOT KITCHEN print patch')
