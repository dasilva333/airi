# Live2D Custom Animation & Expression Insights (Special Sauce)

This document logs the custom animation and interactive triggers that were removed from the `.model.json` or `.model3.json` manifests to prevent WebGL runtime crashes. These entries lack a `File`/`file` property but demonstrate sophisticated ways the original creators structured their interactive logic.

## 🎭 Model: `live2d_2883004043`
* **Windows Host Path**: `C:\users\h4rdc\Documents\Github\coding-agent\VRMs\packages_live2d\live2d_2883004043.zip`
Total custom entries pruned: **9**

| Group | Entry Name | Custom Properties (Special Sauce) |
| :--- | :--- | :--- |
| choice | Entry 0 | `{"Text": "title", "Choices": [{"Text": "开启誓约动画", "NextMtn": "A"}, {"Text": "关闭誓约动画", "NextMtn": "B"}, {"Text": "开启登录动画", "NextMtn": "C"}, {"Text": "关闭登录动画", "NextMtn": "D"}, {"Text": "开启回港动画", "NextMtn": "E"}, {"Text": "关闭回港动画", "NextMtn": "F"}, {"Text": "开启待机语音", "NextMtn": "G"}, {"Text": "关闭待机语音", "NextMtn": "H"}], "Priority": 4}` |
| A | Entry 0 | `{"VarFloats": [{"Name": "var", "Type": 1, "Code": "equal 1"}, {"Name": "var", "Type": 2, "Code": "assign 0"}]}` |
| B | Entry 0 | `{"VarFloats": [{"Name": "var", "Type": 1, "Code": "equal 0"}, {"Name": "var", "Type": 2, "Code": "assign 1"}]}` |
| C | Entry 0 | `{"VarFloats": [{"Name": "var1", "Type": 1, "Code": "equal 1"}, {"Name": "var1", "Type": 2, "Code": "assign 0"}]}` |
| D | Entry 0 | `{"VarFloats": [{"Name": "var1", "Type": 1, "Code": "equal 0"}, {"Name": "var1", "Type": 2, "Code": "assign 1"}]}` |
| E | Entry 0 | `{"VarFloats": [{"Name": "var2", "Type": 1, "Code": "equal 1"}, {"Name": "var2", "Type": 2, "Code": "assign 0"}]}` |
| F | Entry 0 | `{"VarFloats": [{"Name": "var2", "Type": 1, "Code": "equal 0"}, {"Name": "var2", "Type": 2, "Code": "assign 1"}]}` |
| G | Entry 0 | `{"VarFloats": [{"Name": "var3", "Type": 1, "Code": "equal 1"}, {"Name": "var3", "Type": 2, "Code": "assign 0"}]}` |
| H | Entry 0 | `{"VarFloats": [{"Name": "var3", "Type": 1, "Code": "equal 0"}, {"Name": "var3", "Type": 2, "Code": "assign 1"}]}` |

---

## 🎭 Model: `live2d_3165421164`
* **Windows Host Path**: `C:\users\h4rdc\Documents\Github\coding-agent\VRMs\packages_live2d\live2d_3165421164.zip`
Total custom entries pruned: **5**

| Group | Entry Name | Custom Properties (Special Sauce) |
| :--- | :--- | :--- |
| sound | moveStart | `{"Sound": "Motions_sound_0_Sound_0.wav", "SoundLoop": true, "Ignorable": true, "Interruptable": true, "NextMtn": "sound:moveStart"}` |
| sound | moveEnd | `{"Interruptable": true, "NextMtn": "Idle"}` |
| sound | hit | `{"Sound": "Motions_sound_2_Sound_0.wav", "SoundChannel": 1, "Ignorable": true, "Interruptable": true, "NextMtn": "sound:moveStart"}` |
| sound | breathStart | `{"Sound": "Motions_Idle_0_Sound_0.wav", "Ignorable": true, "Interruptable": true, "NextMtn": "sound:breathStart"}` |
| sound | breathEnd | `{"Ignorable": true, "Interruptable": true, "NextMtn": "Idle"}` |

---

## 🎭 Model: `live2d_2262182171`
* **Windows Host Path**: `C:\users\h4rdc\Documents\Github\coding-agent\VRMs\packages_live2d_multi\live2d_2262182171.zip`
Total custom entries pruned: **178**

| Group | Entry Name | Custom Properties (Special Sauce) |
| :--- | :--- | :--- |
| Start | Entry 0 | `{"FadeIn": 0, "FadeOut": 0, "Command": "start_mtn B10;start_mtn Sound#1:011501_051_01_01;start_mtn Face#2:07;clear_exp", "VarFloats": [{"Name": "act", "Type": 2, "Code": "assign 1"}]}` |
| Sound#1 | 011501_002_01 | `{"Sound": "Motions_Sound#1_0_Sound_0.wav", "Text": "これは咲夜が着付けしてくれたの！", "Expression": "exp01.exp3", "NextMtn": "C10"}` |
| Sound#1 | 011501_002_02 | `{"Sound": "Motions_Sound#1_1_Sound_0.wav", "Text": "一緒に花火しようよ。", "PostCommand": "start_mtn Face#2:01", "NextMtn": "Idle"}` |
| Sound#1 | 011501_002_03 | `{"Sound": "Motions_Sound#1_2_Sound_0.wav", "Text": "お姉様と、どっちが似合う？", "NextMtn": "C10"}` |
| Sound#1 | 011501_002_04 | `{"Sound": "Motions_Sound#1_3_Sound_0.wav", "Text": "このお面、いいでしょー。", "Expression": "exp01.exp3", "NextMtn": "C10"}` |
| Sound#1 | 011501_002_05_01 | `{"Sound": "Motions_Sound#1_4_Sound_0.wav", "Text": "下駄って歩きにくいし、足音がうるさいよねぇ。", "NextMtn": "Next:011501_002_05_02"}` |
| Sound#1 | 011501_002_05_02 | `{"Sound": "Motions_Sound#1_5_Sound_0.wav", "Text": "でも大丈夫！困ったときはピューって飛んで行けばいいの。", "NextMtn": "Next:011501_002_05_03"}` |
| Sound#1 | 011501_002_05_03 | `{"Sound": "Motions_Sound#1_6_Sound_0.wav", "Text": "部屋をこっそり抜け出して遊びに行くときは、見つからないように静かに飛んで行くようにしてるんだ。", "NextMtn": "C10"}` |
| Sound#1 | 011501_007_01 | `{"Sound": "Motions_Sound#1_7_Sound_0.wav", "Text": "お祭り、連れてってほしいな～。", "NextMtn": "C10"}` |
| Sound#1 | 011501_007_02 | `{"Sound": "Motions_Sound#1_8_Sound_0.wav", "Text": "お祭りだって！　早く早く！", "NextMtn": "C10"}` |
| Sound#1 | 011501_007_03 | `{"Sound": "Motions_Sound#1_9_Sound_0.wav", "Text": "楽しい楽しいお祭りだよ～。", "Expression": "exp01.exp3", "PostCommand": "clear_exp;start_mtn Face#2:01", "NextMtn": "Idle"}` |
| Sound#1 | 011501_051_01_01 | `{"Sound": "Motions_Sound#1_10_Sound_0.wav", "Text": "わあ、きれいな花火！あっちには金魚すくいがある！焼きそばも美味しそう～。", "Expression": "exp01.exp3", "PostCommand": "clear_exp", "NextMtn": "Next:011501_051_01_02"}` |
| Sound#1 | 011501_051_01_02 | `{"Sound": "Motions_Sound#1_11_Sound_0.wav", "Text": "あら、あなたはだぁれ？私はフランドール・スカーレット。", "NextMtn": "Next:011501_051_01_03"}` |
| Sound#1 | 011501_051_01_03 | `{"Sound": "Motions_Sound#1_12_Sound_0.wav", "Text": "今はお祭りで忙しいから後にして。もっとも、このお祭りがいつ終わるのか、わからないけどね。", "NextMtn": "C10"}` |
| Sound#1 | 011501_008 | `{"Sound": "Motions_Sound#1_13_Sound_0.wav", "Text": "今は支度で忙しいの。", "Expression": "exp01.exp3", "NextMtn": "C10"}` |
| Sound#1 | 011501_009 | `{"Sound": "Motions_Sound#1_14_Sound_0.wav", "Text": "なぁに？　私とお話したいの？", "NextMtn": "C10"}` |
| Sound#1 | 011501_010 | `{"Sound": "Motions_Sound#1_15_Sound_0.wav", "Text": "あなたの浴衣姿も見たいな。", "NextMtn": "C10"}` |
| Sound#1 | 011501_011_01_01 | `{"Sound": "Motions_Sound#1_16_Sound_0.wav", "Text": "見て見て、この浴衣、背中の羽がちゃんと出るようになってるのよ。", "Expression": "exp01.exp3", "PostCommand": "clear_exp", "NextMtn": "Next:011501_011_01_02"}` |
| Sound#1 | 011501_011_01_02 | `{"Sound": "Motions_Sound#1_17_Sound_0.wav", "Text": "すごいでしょ、特製の浴衣なんだから。なんなら帯を触ってもいいんだよ？", "NextMtn": "Next:011501_011_01_03"}` |
| Sound#1 | 011501_011_01_03 | `{"Sound": "Motions_Sound#1_18_Sound_0.wav", "Text": "あ、ちょっとならいいけど、ベタベタ触っちゃダメだからね！", "NextMtn": "C10"}` |
| Sound#1 | 011501_012_01_01 | `{"Sound": "Motions_Sound#1_19_Sound_0.wav", "Text": "あのね、お願いがあるんだけど、", "NextMtn": "Next:011501_012_01_02"}` |
| Sound#1 | 011501_012_01_02 | `{"Sound": "Motions_Sound#1_20_Sound_0.wav", "Text": "私あなたのこととっても気に入ってるから、ずっと一緒にいてほしいの。", "Expression": "exp12.exp3", "PostCommand": "clear_exp", "NextMtn": "Next:011501_012_01_03"}` |
| Sound#1 | 011501_012_01_03 | `{"Sound": "Motions_Sound#1_21_Sound_0.wav", "Text": "もし、勝手にいなくなったりしたら……、「きゅっ」ってしちゃうんだから。", "PostCommand": "start_mtn Face#2:01", "NextMtn": "Idle"}` |
| Sound#1 | 011501_014 | `{"Sound": "Motions_Sound#1_22_Sound_0.wav", "Text": "お姉様の所に行こうかな。", "NextMtn": "C10"}` |
| Sound#1 | 011501_015 | `{"Sound": "Motions_Sound#1_23_Sound_0.wav", "Text": "何してるのー？　暇だよー。", "NextMtn": "C10"}` |
| Sound#1 | 011501_016 | `{"Sound": "Motions_Sound#1_24_Sound_0.wav", "Text": "もう少し遊んでくれないのー？", "NextMtn": "C10"}` |
| Sound#1 | 011501_017 | `{"Sound": "Motions_Sound#1_25_Sound_0.wav", "Text": "あなたがいないと、つまんない……。", "NextMtn": "C10"}` |
| Sound#1 | 011501_018 | `{"Sound": "Motions_Sound#1_26_Sound_0.wav", "Text": "一緒に手を繋いで遊びに行きたーい！", "Expression": "exp01.exp3", "PostCommand": "clear_exp;start_mtn Face#2:01", "NextMtn": "Idle"}` |
| Sound#1 | 011501_003_05_01 | `{"Sound": "Motions_Sound#1_27_Sound_0.wav", "Text": "浴衣って、いろんな柄があるのね。", "Expression": "exp01.exp3", "PostCommand": "clear_exp", "NextMtn": "Next:011501_003_05_02"}` |
| Sound#1 | 011501_003_05_02 | `{"Sound": "Motions_Sound#1_28_Sound_0.wav", "Text": "お姉様におねだりしたら、作ってくれないかなあ？花柄、星柄、ハート柄……。", "NextMtn": "Next:011501_003_05_03"}` |
| Sound#1 | 011501_003_05_03 | `{"Sound": "Motions_Sound#1_29_Sound_0.wav", "Text": "あ、ドクロ柄の浴衣もかわいいかも！", "NextMtn": "C10"}` |
| Sound#1 | 011001_003_02 | `{"Sound": "Motions_Sound#1_30_Sound_0.wav", "Text": "ふわぁ……ねむ～い。", "Expression": "exp01.exp3", "NextMtn": "C10"}` |
| Sound#1 | 011001_003_03 | `{"Sound": "Motions_Sound#1_31_Sound_0.wav", "Text": "私もお花見に行ってみたいの。", "PostCommand": "start_mtn Face#2:01", "NextMtn": "Idle"}` |
| Sound#1 | 011001_003_04 | `{"Sound": "Motions_Sound#1_32_Sound_0.wav", "Text": "お姉様がお茶会をするみたい。", "NextMtn": "C10"}` |
| Sound#1 | 011001_003_05 | `{"Sound": "Motions_Sound#1_33_Sound_0.wav", "Text": "春は桜が綺麗なのよね！", "Expression": "exp01.exp3", "NextMtn": "C10"}` |
| Sound#1 | 011001_004_01 | `{"Sound": "Motions_Sound#1_34_Sound_0.wav", "Text": "あっついわ、とっても。", "Expression": "exp01.exp3", "NextMtn": "C10"}` |
| Sound#1 | 011001_004_03 | `{"Sound": "Motions_Sound#1_35_Sound_0.wav", "Text": "うう～、汗かいちゃったわ。", "NextMtn": "C10"}` |
| Sound#1 | 011001_004_04 | `{"Sound": "Motions_Sound#1_36_Sound_0.wav", "Text": "スイカ割り？壊せばいいの？", "NextMtn": "C10"}` |
| Sound#1 | 011001_004_05 | `{"Sound": "Motions_Sound#1_37_Sound_0.wav", "Text": "夏は星が川になるんでしょ？", "PostCommand": "start_mtn Face#2:01", "NextMtn": "Idle"}` |
| Sound#1 | 011501_004_05_01 | `{"Sound": "Motions_Sound#1_38_Sound_0.wav", "Text": "私、夏祭りって大好き！", "NextMtn": "Next:011501_004_05_02"}` |
| Sound#1 | 011501_004_05_02 | `{"Sound": "Motions_Sound#1_39_Sound_0.wav", "Text": "夜なら、私達吸血鬼もお日様を気にせず楽しめるし、", "Expression": "exp01.exp3", "PostCommand": "clear_exp", "NextMtn": "Next:011501_004_05_03"}` |
| Sound#1 | 011501_004_05_03 | `{"Sound": "Motions_Sound#1_40_Sound_0.wav", "Text": "それに人間がいっぱいウロウロしてるから、お腹が空いても困らないしね！", "Expression": "exp01.exp3", "NextMtn": "C10"}` |
| Sound#1 | 011001_005_01 | `{"Sound": "Motions_Sound#1_41_Sound_0.wav", "Text": "何だか、涼しくなってきたわね。", "NextMtn": "C10"}` |
| Sound#1 | 011501_005_05_01 | `{"Sound": "Motions_Sound#1_42_Sound_0.wav", "Text": "はぁ～、いっぱい食べたら、帯が苦しくなっちゃった。", "NextMtn": "Next:011501_005_05_02"}` |
| Sound#1 | 011501_005_05_02 | `{"Sound": "Motions_Sound#1_43_Sound_0.wav", "Text": "何を食べたのかって？ふふっ、それは秘密。", "NextMtn": "Next:011501_005_05_03"}` |
| Sound#1 | 011501_005_05_03 | `{"Sound": "Motions_Sound#1_44_Sound_0.wav", "Text": "食欲の秋って、食材も太って美味しくなるんだよね♪", "Expression": "exp01.exp3", "NextMtn": "C10"}` |
| Sound#1 | 011001_005_03 | `{"Sound": "Motions_Sound#1_45_Sound_0.wav", "Text": "読書の秋、本は読み飽きたわ。", "Expression": "exp01.exp3", "NextMtn": "C10"}` |
| Sound#1 | 011001_005_04 | `{"Sound": "Motions_Sound#1_46_Sound_0.wav", "Text": "落ち葉狩りって、どうやって狩るの？", "NextMtn": "C10"}` |
| Sound#1 | 011001_005_05 | `{"Sound": "Motions_Sound#1_47_Sound_0.wav", "Text": "私も焼き芋してみたいな。", "PostCommand": "start_mtn Face#2:01", "NextMtn": "Idle"}` |
| Sound#1 | 011001_006_01 | `{"Sound": "Motions_Sound#1_48_Sound_0.wav", "Text": "うぅ～寒いわ！", "Expression": "exp01.exp3", "NextMtn": "C10"}` |
| Sound#1 | 011001_006_02 | `{"Sound": "Motions_Sound#1_49_Sound_0.wav", "Text": "お庭が真っ白になってたわ。", "NextMtn": "C10"}` |
| Sound#1 | 011001_006_03 | `{"Sound": "Motions_Sound#1_50_Sound_0.wav", "Text": "私、雪合戦がしてみたい！", "PostCommand": "start_mtn Face#2:01", "NextMtn": "Idle"}` |
| Sound#1 | 011001_006_04 | `{"Sound": "Motions_Sound#1_51_Sound_0.wav", "Text": "風邪を引かないでね？", "NextMtn": "C10"}` |
| Sound#1 | 011501_006_05_01 | `{"Sound": "Motions_Sound#1_52_Sound_0.wav", "Text": "え？　冬にこの格好は寒くないのかって？", "NextMtn": "Next:011501_006_05_02"}` |
| Sound#1 | 011501_006_05_02 | `{"Sound": "Motions_Sound#1_53_Sound_0.wav", "Text": "へーきへーき、だって私、普段もこんな感じの格好だし！", "Expression": "exp01.exp3", "PostCommand": "clear_exp", "NextMtn": "Next:011501_006_05_03"}` |
| Sound#1 | 011501_006_05_03 | `{"Sound": "Motions_Sound#1_54_Sound_0.wav", "Text": "一年中、いつだってかわいい格好したいもんね♪", "PostCommand": "start_mtn Face#2:01", "NextMtn": "Idle"}` |
| Next | 011501_002_05_02 | `{"Command": "start_mtn B40;start_mtn Sound#1:011501_002_05_02;start_mtn Face#2:02"}` |
| Next | 011501_002_05_03 | `{"Command": "start_mtn B20;start_mtn Sound#1:011501_002_05_03;start_mtn Face#2:01"}` |
| Next | 011501_051_01_02 | `{"Command": "start_mtn B40;start_mtn Sound#1:011501_051_01_02;start_mtn Face#2:01"}` |
| Next | 011501_051_01_03 | `{"Command": "start_mtn B30;start_mtn Sound#1:011501_051_01_03;start_mtn Face#2:02"}` |
| Next | cos | `{"Command": "change_cos model1.json"}` |
| Next | 011501_011_01_02 | `{"Command": "start_mtn B30;start_mtn Sound#1:011501_011_01_02;start_mtn Face#2:07"}` |
| Next | 011501_011_01_03 | `{"Command": "start_mtn B20;start_mtn Sound#1:011501_011_01_03;start_mtn Face#2:05"}` |
| Next | 011501_012_01_02 | `{"Command": "start_mtn B20;start_mtn Sound#1:011501_012_01_02;start_mtn Face#2:07"}` |
| Next | 011501_012_01_03 | `{"Command": "start_mtn B10;start_mtn Sound#1:011501_012_01_03;start_mtn Face#2:07"}` |
| Next | Leaveon | `{"Command": "motions enable Leave60_70_80"}` |
| Next | Leaveoff | `{"Command": "motions disable Leave60_70_80"}` |
| Next | 011501_003_05_02 | `{"Command": "start_mtn B20;start_mtn Sound#1:011501_003_05_02;start_mtn Face#2:08"}` |
| Next | 011501_003_05_03 | `{"Command": "start_mtn B40;start_mtn Sound#1:011501_003_05_03;start_mtn Face#2:07"}` |
| Next | 011501_004_05_02 | `{"Command": "start_mtn B20;start_mtn Sound#1:011501_004_05_02;start_mtn Face#2:01"}` |
| Next | 011501_004_05_03 | `{"Command": "start_mtn B30;start_mtn Sound#1:011501_004_05_03;start_mtn Face#2:02"}` |
| Next | 011501_005_05_02 | `{"Command": "start_mtn B10;start_mtn Sound#1:011501_005_05_02;start_mtn Face#2:02"}` |
| Next | 011501_005_05_03 | `{"Command": "start_mtn B30;start_mtn Sound#1:011501_005_05_03;start_mtn Face#2:07"}` |
| Next | 011501_006_05_02 | `{"Command": "start_mtn B30;start_mtn Sound#1:011501_006_05_02;start_mtn Face#2:07"}` |
| Next | 011501_006_05_03 | `{"Command": "start_mtn B10;start_mtn Sound#1:011501_006_05_03;start_mtn Face#2:02"}` |
| Taphead | Entry 0 | `{"Command": "start_mtn B40;start_mtn Sound#1:011501_002_01;start_mtn Face#2:02;clear_exp", "Intimacy": {"Bonus": 1}}` |
| Taphead | Entry 1 | `{"Command": "start_mtn B10;start_mtn Sound#1:011501_002_02;start_mtn Face#2:01;clear_exp", "Intimacy": {"Bonus": 1}}` |
| Taphead | Entry 2 | `{"Command": "start_mtn B30;start_mtn Sound#1:011501_002_03;start_mtn Face#2:02;clear_exp", "Intimacy": {"Bonus": 1}}` |
| Taphead | Entry 3 | `{"Command": "start_mtn B20;start_mtn Sound#1:011501_002_04;start_mtn Face#2:07;clear_exp", "Intimacy": {"Bonus": 1}}` |
| Taphead | Entry 4 | `{"Command": "start_mtn B50;start_mtn Sound#1:011501_002_05_01;start_mtn Face#2:03;clear_exp", "Intimacy": {"Bonus": 1}}` |
| Tapbody | Entry 0 | `{"Command": "start_mtn B40;start_mtn Sound#1:011501_008;start_mtn Face#2:01;clear_exp", "Intimacy": {"Min": 20, "Bonus": 1}}` |
| Tapbody | Entry 1 | `{"Command": "start_mtn B20;start_mtn Sound#1:011501_009;start_mtn Face#2:01;clear_exp", "Intimacy": {"Min": 40, "Bonus": 1}}` |
| Tapbody | Entry 2 | `{"Command": "start_mtn B50;start_mtn Sound#1:011501_010;start_mtn Face#2:07;clear_exp", "Intimacy": {"Min": 60, "Bonus": 1}}` |
| Tapbody | Entry 3 | `{"Command": "start_mtn B40;start_mtn Sound#1:011501_011_01_01;start_mtn Face#2:02;clear_exp", "Intimacy": {"Min": 80, "Bonus": 1}}` |
| Tapbody | Entry 4 | `{"Command": "start_mtn B50;start_mtn Sound#1:011501_012_01_01;start_mtn Face#2:08;clear_exp", "Intimacy": {"Min": 100, "Bonus": 1}}` |
| Tapbody | Entry 5 | `{"Text": "好感度大于20解锁", "Intimacy": {"Max": 19}}` |
| TapHandL | Entry 0 | `{"Command": "start_mtn B50;start_mtn Sound#1:011501_007_01;start_mtn Face#2:03;clear_exp", "Intimacy": {"Bonus": 1}}` |
| TapHandL | Entry 1 | `{"Command": "start_mtn B30;start_mtn Sound#1:011501_007_02;start_mtn Face#2:07;clear_exp", "Intimacy": {"Bonus": 1}}` |
| TapHandL | Entry 2 | `{"Command": "start_mtn B10;start_mtn Sound#1:011501_007_03;start_mtn Face#2:02;clear_exp", "Intimacy": {"Bonus": 1}}` |
| TapHandR | Entry 0 | `{"Command": "start_mtn B50;start_mtn Sound#1:011501_007_01;start_mtn Face#2:03;clear_exp", "Intimacy": {"Bonus": 1}}` |
| TapHandR | Entry 1 | `{"Command": "start_mtn B30;start_mtn Sound#1:011501_007_02;start_mtn Face#2:07;clear_exp", "Intimacy": {"Bonus": 1}}` |
| TapHandR | Entry 2 | `{"Command": "start_mtn B10;start_mtn Sound#1:011501_007_03;start_mtn Face#2:02;clear_exp", "Intimacy": {"Bonus": 1}}` |
| Tapchange | Entry 0 | `{"Text": "菜单", "Choices": [{"Text": "更换造型：原版皮肤", "NextMtn": "Next:cos"}, {"Text": "放置动作：开", "NextMtn": "Next:Leaveon"}, {"Text": "放置动作：关", "NextMtn": "Next:Leaveoff"}, {"Text": "放置动作", "NextMtn": "Leave60_70_80"}, {"Text": "季节动作", "NextMtn": "Season"}], "TextDuration": 5000}` |
| Leave60_70_80 | Entry 0 | `{"Command": "start_mtn B50;start_mtn Sound#1:011501_014;start_mtn Face#2:01;clear_exp"}` |
| Leave60_70_80 | Entry 1 | `{"Command": "start_mtn B30;start_mtn Sound#1:011501_015;start_mtn Face#2:03;clear_exp"}` |
| Leave60_70_80 | Entry 2 | `{"Command": "start_mtn B40;start_mtn Sound#1:011501_016;start_mtn Face#2:03;clear_exp"}` |
| Leave60_70_80 | Entry 3 | `{"Command": "start_mtn B20;start_mtn Sound#1:011501_017;start_mtn Face#2:08;clear_exp"}` |
| Leave60_70_80 | Entry 4 | `{"Command": "start_mtn B10;start_mtn Sound#1:011501_018;start_mtn Face#2:02;clear_exp"}` |
| Season | Entry 0 | `{"Command": "start_mtn B10;start_mtn Sound#1:011501_003_05_01;start_mtn Face#2:01;clear_exp"}` |
| Season | Entry 1 | `{"Command": "start_mtn B50;start_mtn Sound#1:011001_003_02;start_mtn Face#2:08;clear_exp"}` |
| Season | Entry 2 | `{"Command": "start_mtn B10;start_mtn Sound#1:011001_003_03;start_mtn Face#2:07;clear_exp"}` |
| Season | Entry 3 | `{"Command": "start_mtn B20;start_mtn Sound#1:011001_003_04;start_mtn Face#2:01;clear_exp"}` |
| Season | Entry 4 | `{"Command": "start_mtn B40;start_mtn Sound#1:011001_003_05;start_mtn Face#2:02;clear_exp"}` |
| Season | Entry 5 | `{"Command": "start_mtn B50;start_mtn Sound#1:011001_004_01;start_mtn Face#2:03;clear_exp"}` |
| Season | Entry 6 | `{"Command": "start_mtn B10;start_mtn Sound#1:011001_004_05;start_mtn Face#2:01;clear_exp"}` |
| Season | Entry 7 | `{"Command": "start_mtn B20;start_mtn Sound#1:011001_004_03;start_mtn Face#2:08;clear_exp"}` |
| Season | Entry 8 | `{"Command": "start_mtn B30;start_mtn Sound#1:011001_004_04;start_mtn Face#2:07;clear_exp"}` |
| Season | Entry 9 | `{"Command": "start_mtn B40;start_mtn Sound#1:011501_004_05_01;start_mtn Face#2:02;clear_exp"}` |
| Season | Entry 10 | `{"Command": "start_mtn B30;start_mtn Sound#1:011001_005_01;start_mtn Face#2:01;clear_exp"}` |
| Season | Entry 11 | `{"Command": "start_mtn B50;start_mtn Sound#1:011501_005_05_01;start_mtn Face#2:08;clear_exp"}` |
| Season | Entry 12 | `{"Command": "start_mtn B40;start_mtn Sound#1:011001_005_03;start_mtn Face#2:03;clear_exp"}` |
| Season | Entry 13 | `{"Command": "start_mtn B50;start_mtn Sound#1:011001_005_04;start_mtn Face#2:01;clear_exp"}` |
| Season | Entry 14 | `{"Command": "start_mtn B10;start_mtn Sound#1:011001_005_05;start_mtn Face#2:03;clear_exp"}` |
| Season | Entry 15 | `{"Command": "start_mtn B50;start_mtn Sound#1:011001_006_01;start_mtn Face#2:03;clear_exp"}` |
| Season | Entry 16 | `{"Command": "start_mtn B30;start_mtn Sound#1:011001_006_02;start_mtn Face#2:01;clear_exp"}` |
| Season | Entry 17 | `{"Command": "start_mtn B40;start_mtn Sound#1:011501_006_05_01;start_mtn Face#2:06;clear_exp"}` |
| Season | Entry 18 | `{"Command": "start_mtn B20;start_mtn Sound#1:011001_006_04;start_mtn Face#2:03;clear_exp"}` |
| Season | Entry 19 | `{"Command": "start_mtn B10;start_mtn Sound#1:011001_006_03;start_mtn Face#2:02;clear_exp"}` |
| Tapskirt | Entry 0 | `{"Command": "start_mtn B10;start_mtn Sound#1:011501_003_05_01;start_mtn Face#2:01;clear_exp", "TimeLimit": {"Month": 3, "Sustain": 92160}, "Intimacy": {"Bonus": 1}}` |
| Tapskirt | Entry 1 | `{"Command": "start_mtn B50;start_mtn Sound#1:011001_003_02;start_mtn Face#2:08;clear_exp", "TimeLimit": {"Month": 3, "Sustain": 92160}, "Intimacy": {"Bonus": 1}}` |
| Tapskirt | Entry 2 | `{"Command": "start_mtn B10;start_mtn Sound#1:011001_003_03;start_mtn Face#2:07;clear_exp", "TimeLimit": {"Month": 3, "Sustain": 92160}, "Intimacy": {"Bonus": 1}}` |
| Tapskirt | Entry 3 | `{"Command": "start_mtn B20;start_mtn Sound#1:011001_003_04;start_mtn Face#2:01;clear_exp", "TimeLimit": {"Month": 3, "Sustain": 92160}, "Intimacy": {"Bonus": 1}}` |
| Tapskirt | Entry 4 | `{"Command": "start_mtn B40;start_mtn Sound#1:011001_003_05;start_mtn Face#2:02;clear_exp", "TimeLimit": {"Month": 3, "Sustain": 92160}, "Intimacy": {"Bonus": 1}}` |
| Tapskirt | Entry 5 | `{"Command": "start_mtn B50;start_mtn Sound#1:011001_004_01;start_mtn Face#2:03;clear_exp", "TimeLimit": {"Month": 6, "Sustain": 92160}, "Intimacy": {"Bonus": 1}}` |
| Tapskirt | Entry 6 | `{"Command": "start_mtn B10;start_mtn Sound#1:011001_004_05;start_mtn Face#2:01;clear_exp", "TimeLimit": {"Month": 6, "Sustain": 92160}, "Intimacy": {"Bonus": 1}}` |
| Tapskirt | Entry 7 | `{"Command": "start_mtn B20;start_mtn Sound#1:011001_004_03;start_mtn Face#2:08;clear_exp", "TimeLimit": {"Month": 6, "Sustain": 92160}, "Intimacy": {"Bonus": 1}}` |
| Tapskirt | Entry 8 | `{"Command": "start_mtn B30;start_mtn Sound#1:011001_004_04;start_mtn Face#2:07;clear_exp", "TimeLimit": {"Month": 6, "Sustain": 92160}, "Intimacy": {"Bonus": 1}}` |
| Tapskirt | Entry 9 | `{"Command": "start_mtn B40;start_mtn Sound#1:011501_004_05_01;start_mtn Face#2:02;clear_exp", "TimeLimit": {"Month": 6, "Sustain": 92160}, "Intimacy": {"Bonus": 1}}` |
| Tapskirt | Entry 10 | `{"Command": "start_mtn B30;start_mtn Sound#1:011001_005_01;start_mtn Face#2:01;clear_exp", "TimeLimit": {"Month": 9, "Sustain": 92160}, "Intimacy": {"Bonus": 1}}` |
| Tapskirt | Entry 11 | `{"Command": "start_mtn B50;start_mtn Sound#1:011501_005_05_01;start_mtn Face#2:08;clear_exp", "TimeLimit": {"Month": 9, "Sustain": 92160}, "Intimacy": {"Bonus": 1}}` |
| Tapskirt | Entry 12 | `{"Command": "start_mtn B40;start_mtn Sound#1:011001_005_03;start_mtn Face#2:03;clear_exp", "TimeLimit": {"Month": 9, "Sustain": 92160}, "Intimacy": {"Bonus": 1}}` |
| Tapskirt | Entry 13 | `{"Command": "start_mtn B50;start_mtn Sound#1:011001_005_04;start_mtn Face#2:01;clear_exp", "TimeLimit": {"Month": 9, "Sustain": 92160}, "Intimacy": {"Bonus": 1}}` |
| Tapskirt | Entry 14 | `{"Command": "start_mtn B10;start_mtn Sound#1:011001_005_05;start_mtn Face#2:03;clear_exp", "TimeLimit": {"Month": 9, "Sustain": 92160}, "Intimacy": {"Bonus": 1}}` |
| Tapskirt | Entry 15 | `{"Command": "start_mtn B50;start_mtn Sound#1:011001_006_01;start_mtn Face#2:03;clear_exp", "TimeLimit": {"Month": 12, "Sustain": 92160}, "Intimacy": {"Bonus": 1}}` |
| Tapskirt | Entry 16 | `{"Command": "start_mtn B30;start_mtn Sound#1:011001_006_02;start_mtn Face#2:01;clear_exp", "TimeLimit": {"Month": 12, "Sustain": 92160}, "Intimacy": {"Bonus": 1}}` |
| Tapskirt | Entry 17 | `{"Command": "start_mtn B40;start_mtn Sound#1:011501_006_05_01;start_mtn Face#2:06;clear_exp", "TimeLimit": {"Month": 12, "Sustain": 92160}, "Intimacy": {"Bonus": 1}}` |
| Tapskirt | Entry 18 | `{"Command": "start_mtn B20;start_mtn Sound#1:011001_006_04;start_mtn Face#2:03;clear_exp", "TimeLimit": {"Month": 12, "Sustain": 92160}, "Intimacy": {"Bonus": 1}}` |
| Tapskirt | Entry 19 | `{"Command": "start_mtn B10;start_mtn Sound#1:011001_006_03;start_mtn Face#2:02;clear_exp", "TimeLimit": {"Month": 12, "Sustain": 92160}, "Intimacy": {"Bonus": 1}}` |
| TapLeg_L | Entry 0 | `{"Command": "start_mtn B10;start_mtn Sound#1:011501_003_05_01;start_mtn Face#2:01;clear_exp", "TimeLimit": {"Month": 3, "Sustain": 92160}, "Intimacy": {"Bonus": 1}}` |
| TapLeg_L | Entry 1 | `{"Command": "start_mtn B50;start_mtn Sound#1:011001_003_02;start_mtn Face#2:08;clear_exp", "TimeLimit": {"Month": 3, "Sustain": 92160}, "Intimacy": {"Bonus": 1}}` |
| TapLeg_L | Entry 2 | `{"Command": "start_mtn B10;start_mtn Sound#1:011001_003_03;start_mtn Face#2:07;clear_exp", "TimeLimit": {"Month": 3, "Sustain": 92160}, "Intimacy": {"Bonus": 1}}` |
| TapLeg_L | Entry 3 | `{"Command": "start_mtn B20;start_mtn Sound#1:011001_003_04;start_mtn Face#2:01;clear_exp", "TimeLimit": {"Month": 3, "Sustain": 92160}, "Intimacy": {"Bonus": 1}}` |
| TapLeg_L | Entry 4 | `{"Command": "start_mtn B40;start_mtn Sound#1:011001_003_05;start_mtn Face#2:02;clear_exp", "TimeLimit": {"Month": 3, "Sustain": 92160}, "Intimacy": {"Bonus": 1}}` |
| TapLeg_L | Entry 5 | `{"Command": "start_mtn B50;start_mtn Sound#1:011001_004_01;start_mtn Face#2:03;clear_exp", "TimeLimit": {"Month": 6, "Sustain": 92160}, "Intimacy": {"Bonus": 1}}` |
| TapLeg_L | Entry 6 | `{"Command": "start_mtn B10;start_mtn Sound#1:011001_004_05;start_mtn Face#2:01;clear_exp", "TimeLimit": {"Month": 6, "Sustain": 92160}, "Intimacy": {"Bonus": 1}}` |
| TapLeg_L | Entry 7 | `{"Command": "start_mtn B20;start_mtn Sound#1:011001_004_03;start_mtn Face#2:08;clear_exp", "TimeLimit": {"Month": 6, "Sustain": 92160}, "Intimacy": {"Bonus": 1}}` |
| TapLeg_L | Entry 8 | `{"Command": "start_mtn B30;start_mtn Sound#1:011001_004_04;start_mtn Face#2:07;clear_exp", "TimeLimit": {"Month": 6, "Sustain": 92160}, "Intimacy": {"Bonus": 1}}` |
| TapLeg_L | Entry 9 | `{"Command": "start_mtn B40;start_mtn Sound#1:011501_004_05_01;start_mtn Face#2:02;clear_exp", "TimeLimit": {"Month": 6, "Sustain": 92160}, "Intimacy": {"Bonus": 1}}` |
| TapLeg_L | Entry 10 | `{"Command": "start_mtn B30;start_mtn Sound#1:011001_005_01;start_mtn Face#2:01;clear_exp", "TimeLimit": {"Month": 9, "Sustain": 92160}, "Intimacy": {"Bonus": 1}}` |
| TapLeg_L | Entry 11 | `{"Command": "start_mtn B50;start_mtn Sound#1:011501_005_05_01;start_mtn Face#2:08;clear_exp", "TimeLimit": {"Month": 9, "Sustain": 92160}, "Intimacy": {"Bonus": 1}}` |
| TapLeg_L | Entry 12 | `{"Command": "start_mtn B40;start_mtn Sound#1:011001_005_03;start_mtn Face#2:03;clear_exp", "TimeLimit": {"Month": 9, "Sustain": 92160}, "Intimacy": {"Bonus": 1}}` |
| TapLeg_L | Entry 13 | `{"Command": "start_mtn B50;start_mtn Sound#1:011001_005_04;start_mtn Face#2:01;clear_exp", "TimeLimit": {"Month": 9, "Sustain": 92160}, "Intimacy": {"Bonus": 1}}` |
| TapLeg_L | Entry 14 | `{"Command": "start_mtn B10;start_mtn Sound#1:011001_005_05;start_mtn Face#2:03;clear_exp", "TimeLimit": {"Month": 9, "Sustain": 92160}, "Intimacy": {"Bonus": 1}}` |
| TapLeg_L | Entry 15 | `{"Command": "start_mtn B50;start_mtn Sound#1:011001_006_01;start_mtn Face#2:03;clear_exp", "TimeLimit": {"Month": 12, "Sustain": 92160}, "Intimacy": {"Bonus": 1}}` |
| TapLeg_L | Entry 16 | `{"Command": "start_mtn B30;start_mtn Sound#1:011001_006_02;start_mtn Face#2:01;clear_exp", "TimeLimit": {"Month": 12, "Sustain": 92160}, "Intimacy": {"Bonus": 1}}` |
| TapLeg_L | Entry 17 | `{"Command": "start_mtn B40;start_mtn Sound#1:011501_006_05_01;start_mtn Face#2:06;clear_exp", "TimeLimit": {"Month": 12, "Sustain": 92160}, "Intimacy": {"Bonus": 1}}` |
| TapLeg_L | Entry 18 | `{"Command": "start_mtn B20;start_mtn Sound#1:011001_006_04;start_mtn Face#2:03;clear_exp", "TimeLimit": {"Month": 12, "Sustain": 92160}, "Intimacy": {"Bonus": 1}}` |
| TapLeg_L | Entry 19 | `{"Command": "start_mtn B10;start_mtn Sound#1:011001_006_03;start_mtn Face#2:02;clear_exp", "TimeLimit": {"Month": 12, "Sustain": 92160}, "Intimacy": {"Bonus": 1}}` |
| TapLeg_R | Entry 0 | `{"Command": "start_mtn B10;start_mtn Sound#1:011501_003_05_01;start_mtn Face#2:01;clear_exp", "TimeLimit": {"Month": 3, "Sustain": 92160}, "Intimacy": {"Bonus": 1}}` |
| TapLeg_R | Entry 1 | `{"Command": "start_mtn B50;start_mtn Sound#1:011001_003_02;start_mtn Face#2:08;clear_exp", "TimeLimit": {"Month": 3, "Sustain": 92160}, "Intimacy": {"Bonus": 1}}` |
| TapLeg_R | Entry 2 | `{"Command": "start_mtn B10;start_mtn Sound#1:011001_003_03;start_mtn Face#2:07;clear_exp", "TimeLimit": {"Month": 3, "Sustain": 92160}, "Intimacy": {"Bonus": 1}}` |
| TapLeg_R | Entry 3 | `{"Command": "start_mtn B20;start_mtn Sound#1:011001_003_04;start_mtn Face#2:01;clear_exp", "TimeLimit": {"Month": 3, "Sustain": 92160}, "Intimacy": {"Bonus": 1}}` |
| TapLeg_R | Entry 4 | `{"Command": "start_mtn B40;start_mtn Sound#1:011001_003_05;start_mtn Face#2:02;clear_exp", "TimeLimit": {"Month": 3, "Sustain": 92160}, "Intimacy": {"Bonus": 1}}` |
| TapLeg_R | Entry 5 | `{"Command": "start_mtn B50;start_mtn Sound#1:011001_004_01;start_mtn Face#2:03;clear_exp", "TimeLimit": {"Month": 6, "Sustain": 92160}, "Intimacy": {"Bonus": 1}}` |
| TapLeg_R | Entry 6 | `{"Command": "start_mtn B10;start_mtn Sound#1:011001_004_05;start_mtn Face#2:01;clear_exp", "TimeLimit": {"Month": 6, "Sustain": 92160}, "Intimacy": {"Bonus": 1}}` |
| TapLeg_R | Entry 7 | `{"Command": "start_mtn B20;start_mtn Sound#1:011001_004_03;start_mtn Face#2:08;clear_exp", "TimeLimit": {"Month": 6, "Sustain": 92160}, "Intimacy": {"Bonus": 1}}` |
| TapLeg_R | Entry 8 | `{"Command": "start_mtn B30;start_mtn Sound#1:011001_004_04;start_mtn Face#2:07;clear_exp", "TimeLimit": {"Month": 6, "Sustain": 92160}, "Intimacy": {"Bonus": 1}}` |
| TapLeg_R | Entry 9 | `{"Command": "start_mtn B40;start_mtn Sound#1:011501_004_05_01;start_mtn Face#2:02;clear_exp", "TimeLimit": {"Month": 6, "Sustain": 92160}, "Intimacy": {"Bonus": 1}}` |
| TapLeg_R | Entry 10 | `{"Command": "start_mtn B30;start_mtn Sound#1:011001_005_01;start_mtn Face#2:01;clear_exp", "TimeLimit": {"Month": 9, "Sustain": 92160}, "Intimacy": {"Bonus": 1}}` |
| TapLeg_R | Entry 11 | `{"Command": "start_mtn B50;start_mtn Sound#1:011501_005_05_01;start_mtn Face#2:08;clear_exp", "TimeLimit": {"Month": 9, "Sustain": 92160}, "Intimacy": {"Bonus": 1}}` |
| TapLeg_R | Entry 12 | `{"Command": "start_mtn B40;start_mtn Sound#1:011001_005_03;start_mtn Face#2:03;clear_exp", "TimeLimit": {"Month": 9, "Sustain": 92160}, "Intimacy": {"Bonus": 1}}` |
| TapLeg_R | Entry 13 | `{"Command": "start_mtn B50;start_mtn Sound#1:011001_005_04;start_mtn Face#2:01;clear_exp", "TimeLimit": {"Month": 9, "Sustain": 92160}, "Intimacy": {"Bonus": 1}}` |
| TapLeg_R | Entry 14 | `{"Command": "start_mtn B10;start_mtn Sound#1:011001_005_05;start_mtn Face#2:03;clear_exp", "TimeLimit": {"Month": 9, "Sustain": 92160}, "Intimacy": {"Bonus": 1}}` |
| TapLeg_R | Entry 15 | `{"Command": "start_mtn B50;start_mtn Sound#1:011001_006_01;start_mtn Face#2:03;clear_exp", "TimeLimit": {"Month": 12, "Sustain": 92160}, "Intimacy": {"Bonus": 1}}` |
| TapLeg_R | Entry 16 | `{"Command": "start_mtn B30;start_mtn Sound#1:011001_006_02;start_mtn Face#2:01;clear_exp", "TimeLimit": {"Month": 12, "Sustain": 92160}, "Intimacy": {"Bonus": 1}}` |
| TapLeg_R | Entry 17 | `{"Command": "start_mtn B40;start_mtn Sound#1:011501_006_05_01;start_mtn Face#2:06;clear_exp", "TimeLimit": {"Month": 12, "Sustain": 92160}, "Intimacy": {"Bonus": 1}}` |
| TapLeg_R | Entry 18 | `{"Command": "start_mtn B20;start_mtn Sound#1:011001_006_04;start_mtn Face#2:03;clear_exp", "TimeLimit": {"Month": 12, "Sustain": 92160}, "Intimacy": {"Bonus": 1}}` |
| TapLeg_R | Entry 19 | `{"Command": "start_mtn B10;start_mtn Sound#1:011001_006_03;start_mtn Face#2:02;clear_exp", "TimeLimit": {"Month": 12, "Sustain": 92160}, "Intimacy": {"Bonus": 1}}` |

---

## 🎭 Model: `live2d_3626567931`
* **Windows Host Path**: `C:\users\h4rdc\Documents\Github\coding-agent\VRMs\packages_live2d\live2d_3626567931.zip.zip`
Total custom entries pruned: **403**

| Group | Entry Name | Custom Properties (Special Sauce) |
| :--- | :--- | :--- |
| Start | Init | `{"MotionDuration": 1500, "NextMtn": "InitNext", "Weight": 999, "VarFloats": [{"Name": "StartOver", "Type": 2, "Code": "assign 0"}]}` |
| InitNext | InitNext | `{"Command": "start_mtn FStartPrev", "Weight": 999, "VarFloats": [{"Name": "DoubleClickTimer", "Type": 2, "Code": "assign 0"}, {"Name": "BGMTimer", "Type": 2, "Code": "assign 2"}, {"Name": "ChatTimer", "Type": 2, "Code": "assign rand(20,25)"}, {"Name": "IntimacyVI", "Type": 2, "Code": "init 0"}, {"Name": "StopTimer", "Type": 2, "Code": "assign 0"}, {"Name": "OpenChat", "Type": 2, "Code": "init 1"}, {"Name": "InMouseTracking", "Type": 2, "Code": "init 1"}, {"Name": "InIdle", "Type": 2, "Code": "init 1"}, {"Name": "InDebug", "Type": 2, "Code": "assign 0"}, {"Name": "DragLock", "Type": 2, "Code": "init 0"}, {"Name": "DateFlag", "Type": 2, "Code": "init 0"}, {"Name": "InWeekend", "Type": 2, "Code": "init 0"}, {"Name": "InPlayerBirthday", "Type": 2, "Code": "init 0"}, {"Name": "InValentine", "Type": 2, "Code": "init 0"}, {"Name": "InBirthday", "Type": 2, "Code": "init 0"}, {"Name": "InSpringFestival", "Type": 2, "Code": "init 0"}, {"Name": "InQixi", "Type": 2, "Code": "init 0"}, {"Name": "InChristmas", "Type": 2, "Code": "init 0"}, {"Name": "InFestival", "Type": 2, "Code": "init 0"}, {"Name": "InENV", "Type": 2, "Code": "init 0"}, {"Name": "InRain", "Type": 2, "Code": "init 0"}, {"Name": "InBGMPlayer", "Type": 2, "Code": "init 0"}, {"Name": "TextureNum", "Type": 2, "Code": "init 0"}]}` |
| Tap | DoubliClick | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "菜单{$br}好感度: {$vi_IntimacyVI}", "Choices": [{"Text": "送礼", "NextMtn": "送礼菜单#99"}, {"Text": "动作菜单", "NextMtn": "动作菜单#99"}, {"Text": "闲聊开关: {$vi_OpenChat}", "NextMtn": "闲聊开关#99"}, {"Text": "鼠标跟踪: {$vi_InMouseTracking}", "NextMtn": "鼠标跟踪#99"}, {"Text": "待机动作: {$vi_InIdle}", "NextMtn": "待机动作#99"}, {"Text": "重载", "NextMtn": "Reload#99"}, {"Text": "Debug菜单", "NextMtn": "Debug菜单#99"}, {"Text": "日期菜单", "NextMtn": "日期菜单#99"}, {"Text": "环境菜单: {$vi_InENV}", "NextMtn": "环境菜单#99"}, {"Text": "BGM点播: {$vi_InBGMPlayer}", "NextMtn": "BGM点播#99"}, {"Text": "角色菜单", "NextMtn": "角色菜单#99"}, {"Text": "纹理菜单: {$vi_TextureNum}", "NextMtn": "纹理菜单#99"}], "TextDuration": 5000, "VarFloats": [{"Name": "DoubleClickTimer", "Type": 1, "Code": "greater 0"}, {"Name": "DoubleClickTimer", "Type": 2, "Code": "assign 0"}]}` |
| Tap | DoubliClickAdd | `{"VarFloats": [{"Name": "DoubleClickTimer", "Type": 2, "Code": "add 1"}]}` |
| Tap | DoubliClick | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "Menu{$br}Intimacy: {$vi_IntimacyVI}", "Choices": [{"Text": "Gift", "NextMtn": "送礼菜单#99"}, {"Text": "Motion Menu", "NextMtn": "动作菜单#99"}, {"Text": "Chat Switch: {$vi_OpenChat}", "NextMtn": "闲聊开关#99"}, {"Text": "Mouse Track: {$vi_InMouseTracking}", "NextMtn": "鼠标跟踪#99"}, {"Text": "Idle Motion: {$vi_InIdle}", "NextMtn": "待机动作#99"}, {"Text": "Reload", "NextMtn": "Reload#99"}, {"Text": "Debug Menu", "NextMtn": "Debug菜单#99"}, {"Text": "Date Menu", "NextMtn": "日期菜单#99"}, {"Text": "ENV Menu: {$vi_InENV}", "NextMtn": "环境菜单#99"}, {"Text": "BGM Player: {$vi_InBGMPlayer}", "NextMtn": "BGM点播#99"}, {"Text": "Char Menu", "NextMtn": "角色菜单#99"}, {"Text": "Texture Menu: {$vi_TextureNum}", "NextMtn": "纹理菜单#99"}], "TextDuration": 5000, "Language": "en", "VarFloats": [{"Name": "DoubleClickTimer", "Type": 1, "Code": "greater 0"}, {"Name": "DoubleClickTimer", "Type": 2, "Code": "assign 0"}]}` |
| Update1#98 | Update1_0 | `{"NextMtn": "Update2#98", "Weight": 999, "VarFloats": [{"Name": "DoubleClickTimer", "Type": 1, "Code": "greater 0"}, {"Name": "DoubleClickTimer", "Type": 2, "Code": "subtract 1"}, {"Name": "InDebug", "Type": 2, "Code": "assign 0"}]}` |
| Update1#98 | Update1_1 | `{"NextMtn": "Update2#98"}` |
| FStartPrev | FStartPrev_0 | `{"Command": "start_mtn FStartPrev2", "VarFloats": [{"Name": "TextureNum", "Type": 1, "Code": "equal 0"}]}` |
| FStartPrev2 | FStartPrev2_0 | `{"Command": "start_mtn FStartPrev3", "PostCommand": "mouse_tracking enable", "VarFloats": [{"Name": "InMouseTracking", "Type": 1, "Code": "equal 1"}]}` |
| FStartPrev2 | FStartPrev2_1 | `{"Command": "start_mtn FStartPrev3", "PostCommand": "mouse_tracking disable", "VarFloats": [{"Name": "InMouseTracking", "Type": 1, "Code": "not_equal 1"}]}` |
| FStartPrev3 | FStartPrev3_0 | `{"Command": "start_mtn FStartAfter", "PostCommand": "eye_blink disable", "VarFloats": [{"Name": "InIdle", "Type": 1, "Code": "equal 1"}]}` |
| FStartPrev3 | FStartPrev3_1 | `{"Command": "start_mtn FStartAfter", "PostCommand": "eye_blink enable", "VarFloats": [{"Name": "InIdle", "Type": 1, "Code": "not_equal 1"}]}` |
| FStartAfter | FStartAfter_0 | `{"Command": "start_mtn RepairTimer#99;start_mtn FStartAfter2"}` |
| DelayStartMtn#99 | StartMtn | `{"Command": "start_mtn Idle", "PostCommand": "start_mtn StartGreet", "MotionDuration": 1000}` |
| DREFTouchBoxHead-互动-抚摸-普通 | 回弹 | `{"Command": "start_mtn DREFTouchBoxHead-互动-触摸-头"}` |
| TapDREFTouchBoxHead | DREFTouchBoxHead-互动-抚摸-普通 | `{"Command": "start_mtn DREFTouchBoxHead-互动-抚摸-普通", "Weight": 4}` |
| TapDREFTouchBoxHead | DREFTouchBoxHead-互动-抚摸-节日 | `{"Command": "start_mtn DREFTouchBoxHead-互动-抚摸-节日", "Intimacy": {"Min": 6350}, "Weight": 6, "VarFloats": [{"Name": "DateFlag", "Type": 1, "Code": "greater_equal 4"}]}` |
| TapDREFTouchBoxHead | DREFTouchBoxHead-互动-抚摸-结婚后 | `{"Command": "start_mtn DREFTouchBoxHead-互动-抚摸-结婚后", "Intimacy": {"Min": 27450}, "Weight": 4}` |
| TapDREFTouchBoxHead | DREFTouchBoxHead-互动-触摸-头 | `{"Command": "start_mtn DREFTouchBoxHead-互动-触摸-头", "Weight": 8}` |
| DREFTouchBoxHead-互动-抚摸-节日 | 回弹 | `{"Command": "start_mtn DREFTouchBoxHead-互动-触摸-头"}` |
| DREFTouchBoxHead-互动-抚摸-结婚后 | 回弹 | `{"Command": "start_mtn DREFTouchBoxHead-互动-触摸-头"}` |
| DREFTouchBoxHandL-互动-抚摸-普通 | 回弹 | `{"Command": "start_mtn DREFTouchBoxHandL-互动-触摸-手"}` |
| TapDREFTouchBoxHandL | DREFTouchBoxHandL-互动-抚摸-普通 | `{"Command": "start_mtn DREFTouchBoxHandL-互动-抚摸-普通", "Weight": 4}` |
| TapDREFTouchBoxHandL | DREFTouchBoxHandL-互动-抚摸-节日 | `{"Command": "start_mtn DREFTouchBoxHandL-互动-抚摸-节日", "Intimacy": {"Min": 6350}, "Weight": 6, "VarFloats": [{"Name": "DateFlag", "Type": 1, "Code": "greater_equal 4"}]}` |
| TapDREFTouchBoxHandL | DREFTouchBoxHandL-互动-抚摸-结婚后 | `{"Command": "start_mtn DREFTouchBoxHandL-互动-抚摸-结婚后", "Intimacy": {"Min": 27450}, "Weight": 4}` |
| TapDREFTouchBoxHandL | DREFTouchBoxHandL-互动-触摸-手 | `{"Command": "start_mtn DREFTouchBoxHandL-互动-触摸-手", "Weight": 8}` |
| DREFTouchBoxHandL-互动-抚摸-节日 | 回弹 | `{"Command": "start_mtn DREFTouchBoxHandL-互动-触摸-手"}` |
| DREFTouchBoxHandL-互动-抚摸-结婚后 | 回弹 | `{"Command": "start_mtn DREFTouchBoxHandL-互动-触摸-手"}` |
| DREFTouchBoxHip-互动-抚摸-腿 | 回弹 | `{"Command": "start_mtn DREFTouchBoxHip-互动-触摸-腿"}` |
| TapDREFTouchBoxHip | DREFTouchBoxHip-互动-抚摸-腿 | `{"Command": "start_mtn DREFTouchBoxHip-互动-抚摸-腿", "Weight": 4}` |
| TapDREFTouchBoxHip | DREFTouchBoxHip-互动-抚摸-节日 | `{"Command": "start_mtn DREFTouchBoxHip-互动-抚摸-节日", "Intimacy": {"Min": 14350}, "Weight": 6, "VarFloats": [{"Name": "DateFlag", "Type": 1, "Code": "greater_equal 4"}]}` |
| TapDREFTouchBoxHip | DREFTouchBoxHip-互动-抚摸-结婚后 | `{"Command": "start_mtn DREFTouchBoxHip-互动-抚摸-结婚后", "Intimacy": {"Min": 27450}, "Weight": 4}` |
| TapDREFTouchBoxHip | DREFTouchBoxHip-互动-触摸-腿 | `{"Command": "start_mtn DREFTouchBoxHip-互动-触摸-腿", "Weight": 8}` |
| DREFTouchBoxHip-互动-抚摸-节日 | 回弹 | `{"Command": "start_mtn DREFTouchBoxHip-互动-触摸-腿"}` |
| DREFTouchBoxHip-互动-抚摸-结婚后 | 回弹 | `{"Command": "start_mtn DREFTouchBoxHip-互动-触摸-腿"}` |
| DREFTouchBoxBra-互动-抚摸-胸 | 回弹 | `{"Command": "start_mtn DREFTouchBoxBra-互动-触摸-胸"}` |
| TapDREFTouchBoxBra | DREFTouchBoxBra-互动-抚摸-胸 | `{"Command": "start_mtn DREFTouchBoxBra-互动-抚摸-胸", "Weight": 4}` |
| TapDREFTouchBoxBra | DREFTouchBoxBra-互动-抚摸-节日 | `{"Command": "start_mtn DREFTouchBoxBra-互动-抚摸-节日", "Intimacy": {"Min": 6350}, "Weight": 6, "VarFloats": [{"Name": "DateFlag", "Type": 1, "Code": "greater_equal 4"}]}` |
| TapDREFTouchBoxBra | DREFTouchBoxBra-互动-抚摸-结婚后 | `{"Command": "start_mtn DREFTouchBoxBra-互动-抚摸-结婚后", "Intimacy": {"Min": 27450}, "Weight": 4}` |
| TapDREFTouchBoxBra | DREFTouchBoxBra-互动-触摸-胸 | `{"Command": "start_mtn DREFTouchBoxBra-互动-触摸-胸", "Weight": 8}` |
| DREFTouchBoxBra-互动-抚摸-节日 | 回弹 | `{"Command": "start_mtn DREFTouchBoxBra-互动-触摸-胸"}` |
| DREFTouchBoxBra-互动-抚摸-结婚后 | 回弹 | `{"Command": "start_mtn DREFTouchBoxBra-互动-触摸-胸"}` |
| TapDREFTouchBoxHandR | DREFTouchBoxHandR | `{"Command": "start_mtn TapDREFTouchBoxHandL"}` |
| Update2#98 | Update2_0 | `{"PostCommand": "start_mtn BaseBGM#2", "NextMtn": "Update3#98", "Weight": 999, "VarFloats": [{"Name": "BGMTimer", "Type": 1, "Code": "lower_equal 0"}, {"Name": "OpenBGM", "Type": 1, "Code": "equal 1"}, {"Name": "InBGMPlayer", "Type": 1, "Code": "equal 0"}]}` |
| Update2#98 | Update2_1 | `{"NextMtn": "Update3#98", "Weight": 999, "VarFloats": [{"Name": "BGMTimer", "Type": 1, "Code": "greater 0"}, {"Name": "BGMTimer", "Type": 2, "Code": "subtract 0.5"}]}` |
| Update2#98 | Update2_2 | `{"NextMtn": "Update3#98"}` |
| Update3#98 | Update3_0 | `{"PostCommand": "start_mtn Chat", "NextMtn": "Update4#98", "Weight": 999, "VarFloats": [{"Name": "ChatTimer", "Type": 1, "Code": "lower_equal 0"}, {"Name": "OpenChat", "Type": 1, "Code": "equal 1"}, {"Name": "WhisperType", "Type": 1, "Code": "equal 0"}]}` |
| Update3#98 | Update3_1 | `{"NextMtn": "Update4#98", "Weight": 999, "VarFloats": [{"Name": "ChatTimer", "Type": 1, "Code": "greater 0"}, {"Name": "ChatTimer", "Type": 2, "Code": "subtract 0.5"}]}` |
| Update3#98 | Update3_2 | `{"NextMtn": "Update4#98"}` |
| Update4#98 | Update4_0 | `{"PostCommand": "start_mtn 私语路由#99", "NextMtn": "Update5#98", "Weight": 999, "VarFloats": [{"Name": "WhisperTimer", "Type": 1, "Code": "lower_equal 0"}, {"Name": "WhisperType", "Type": 1, "Code": "not_equal 0"}]}` |
| Update4#98 | Update4_1 | `{"NextMtn": "Update5#98", "Weight": 999, "VarFloats": [{"Name": "WhisperTimer", "Type": 1, "Code": "greater 0"}, {"Name": "WhisperTimer", "Type": 2, "Code": "subtract 0.5"}]}` |
| Update4#98 | Update4_2 | `{"NextMtn": "Update5#98"}` |
| Update5#98 | Update5_0 | `{"PostCommand": "start_mtn Idle#2", "NextMtn": "Update6#98", "Weight": 999, "VarFloats": [{"Name": "BGMRepairTimer", "Type": 1, "Code": "lower_equal 0"}, {"Name": "InBGMPlayer", "Type": 1, "Code": "not_equal 0"}]}` |
| Update5#98 | Update5_1 | `{"NextMtn": "Update6#98", "Weight": 999, "VarFloats": [{"Name": "BGMRepairTimer", "Type": 1, "Code": "greater 0"}, {"Name": "BGMRepairTimer", "Type": 2, "Code": "subtract 0.5"}]}` |
| Update5#98 | Update5_2 | `{"NextMtn": "Update6#98"}` |
| Update6#98 | Update6_0 | `{"PostCommand": "start_mtn Idle#4", "NextMtn": "Update7#98", "Weight": 999, "VarFloats": [{"Name": "ENVRepairTimer", "Type": 1, "Code": "lower_equal 0"}, {"Name": "InENV", "Type": 1, "Code": "not_equal 0"}]}` |
| Update6#98 | Update6_1 | `{"NextMtn": "Update7#98", "Weight": 999, "VarFloats": [{"Name": "ENVRepairTimer", "Type": 1, "Code": "greater 0"}, {"Name": "ENVRepairTimer", "Type": 2, "Code": "subtract 0.5"}]}` |
| Update6#98 | Update6_2 | `{"NextMtn": "Update7#98"}` |
| Update7#98 | 1 | `{"Intimacy": {"Min": 0, "Max": 99}, "NextMtn": "Update8#98", "VarFloats": [{"Name": "IntimacyVI", "Type": 2, "Code": "assign 1"}]}` |
| Update7#98 | 2 | `{"Intimacy": {"Min": 100, "Max": 219}, "NextMtn": "Update8#98", "VarFloats": [{"Name": "IntimacyVI", "Type": 2, "Code": "assign 2"}]}` |
| Update7#98 | 3 | `{"Intimacy": {"Min": 220, "Max": 359}, "NextMtn": "Update8#98", "VarFloats": [{"Name": "IntimacyVI", "Type": 2, "Code": "assign 3"}]}` |
| Update7#98 | 4 | `{"Intimacy": {"Min": 360, "Max": 519}, "NextMtn": "Update8#98", "VarFloats": [{"Name": "IntimacyVI", "Type": 2, "Code": "assign 4"}]}` |
| Update7#98 | 5 | `{"Intimacy": {"Min": 520, "Max": 699}, "NextMtn": "Update8#98", "VarFloats": [{"Name": "IntimacyVI", "Type": 2, "Code": "assign 5"}]}` |
| Update7#98 | 6 | `{"Intimacy": {"Min": 700, "Max": 899}, "NextMtn": "Update8#98", "VarFloats": [{"Name": "IntimacyVI", "Type": 2, "Code": "assign 6"}]}` |
| Update7#98 | 7 | `{"Intimacy": {"Min": 900, "Max": 1119}, "NextMtn": "Update8#98", "VarFloats": [{"Name": "IntimacyVI", "Type": 2, "Code": "assign 7"}]}` |
| Update7#98 | 8 | `{"Intimacy": {"Min": 1120, "Max": 1359}, "NextMtn": "Update8#98", "VarFloats": [{"Name": "IntimacyVI", "Type": 2, "Code": "assign 8"}]}` |
| Update7#98 | 9 | `{"Intimacy": {"Min": 1360, "Max": 1619}, "NextMtn": "Update8#98", "VarFloats": [{"Name": "IntimacyVI", "Type": 2, "Code": "assign 9"}]}` |
| Update7#98 | 10 | `{"Intimacy": {"Min": 1620, "Max": 1899}, "NextMtn": "Update8#98", "VarFloats": [{"Name": "IntimacyVI", "Type": 2, "Code": "assign 10"}]}` |
| Update7#98 | 11 | `{"Intimacy": {"Min": 1900, "Max": 2209}, "NextMtn": "Update8#98", "VarFloats": [{"Name": "IntimacyVI", "Type": 2, "Code": "assign 11"}]}` |
| Update7#98 | 12 | `{"Intimacy": {"Min": 2210, "Max": 2549}, "NextMtn": "Update8#98", "VarFloats": [{"Name": "IntimacyVI", "Type": 2, "Code": "assign 12"}]}` |
| Update7#98 | 13 | `{"Intimacy": {"Min": 2550, "Max": 2919}, "NextMtn": "Update8#98", "VarFloats": [{"Name": "IntimacyVI", "Type": 2, "Code": "assign 13"}]}` |
| Update7#98 | 14 | `{"Intimacy": {"Min": 2920, "Max": 3319}, "NextMtn": "Update8#98", "VarFloats": [{"Name": "IntimacyVI", "Type": 2, "Code": "assign 14"}]}` |
| Update7#98 | 15 | `{"Intimacy": {"Min": 3320, "Max": 3749}, "NextMtn": "Update8#98", "VarFloats": [{"Name": "IntimacyVI", "Type": 2, "Code": "assign 15"}]}` |
| Update7#98 | 16 | `{"Intimacy": {"Min": 3750, "Max": 4209}, "NextMtn": "Update8#98", "VarFloats": [{"Name": "IntimacyVI", "Type": 2, "Code": "assign 16"}]}` |
| Update7#98 | 17 | `{"Intimacy": {"Min": 4210, "Max": 4699}, "NextMtn": "Update8#98", "VarFloats": [{"Name": "IntimacyVI", "Type": 2, "Code": "assign 17"}]}` |
| Update7#98 | 18 | `{"Intimacy": {"Min": 4700, "Max": 5219}, "NextMtn": "Update8#98", "VarFloats": [{"Name": "IntimacyVI", "Type": 2, "Code": "assign 18"}]}` |
| Update7#98 | 19 | `{"Intimacy": {"Min": 5220, "Max": 5769}, "NextMtn": "Update8#98", "VarFloats": [{"Name": "IntimacyVI", "Type": 2, "Code": "assign 19"}]}` |
| Update7#98 | 20 | `{"Intimacy": {"Min": 5770, "Max": 6349}, "NextMtn": "Update8#98", "VarFloats": [{"Name": "IntimacyVI", "Type": 2, "Code": "assign 20"}]}` |
| Update7#98 | 21 | `{"Intimacy": {"Min": 6350, "Max": 6969}, "NextMtn": "Update8#98", "VarFloats": [{"Name": "IntimacyVI", "Type": 2, "Code": "assign 21"}]}` |
| Update7#98 | 22 | `{"Intimacy": {"Min": 6970, "Max": 7629}, "NextMtn": "Update8#98", "VarFloats": [{"Name": "IntimacyVI", "Type": 2, "Code": "assign 22"}]}` |
| Update7#98 | 23 | `{"Intimacy": {"Min": 7630, "Max": 8329}, "NextMtn": "Update8#98", "VarFloats": [{"Name": "IntimacyVI", "Type": 2, "Code": "assign 23"}]}` |
| Update7#98 | 24 | `{"Intimacy": {"Min": 8330, "Max": 9069}, "NextMtn": "Update8#98", "VarFloats": [{"Name": "IntimacyVI", "Type": 2, "Code": "assign 24"}]}` |
| Update7#98 | 25 | `{"Intimacy": {"Min": 9070, "Max": 9849}, "NextMtn": "Update8#98", "VarFloats": [{"Name": "IntimacyVI", "Type": 2, "Code": "assign 25"}]}` |
| Update7#98 | 26 | `{"Intimacy": {"Min": 9850, "Max": 10669}, "NextMtn": "Update8#98", "VarFloats": [{"Name": "IntimacyVI", "Type": 2, "Code": "assign 26"}]}` |
| Update7#98 | 27 | `{"Intimacy": {"Min": 10670, "Max": 11529}, "NextMtn": "Update8#98", "VarFloats": [{"Name": "IntimacyVI", "Type": 2, "Code": "assign 27"}]}` |
| Update7#98 | 28 | `{"Intimacy": {"Min": 11530, "Max": 12429}, "NextMtn": "Update8#98", "VarFloats": [{"Name": "IntimacyVI", "Type": 2, "Code": "assign 28"}]}` |
| Update7#98 | 29 | `{"Intimacy": {"Min": 12430, "Max": 13369}, "NextMtn": "Update8#98", "VarFloats": [{"Name": "IntimacyVI", "Type": 2, "Code": "assign 29"}]}` |
| Update7#98 | 30 | `{"Intimacy": {"Min": 13370, "Max": 14349}, "NextMtn": "Update8#98", "VarFloats": [{"Name": "IntimacyVI", "Type": 2, "Code": "assign 30"}]}` |
| Update7#98 | 31 | `{"Intimacy": {"Min": 14350, "Max": 15389}, "NextMtn": "Update8#98", "VarFloats": [{"Name": "IntimacyVI", "Type": 2, "Code": "assign 31"}]}` |
| Update7#98 | 32 | `{"Intimacy": {"Min": 15390, "Max": 16489}, "NextMtn": "Update8#98", "VarFloats": [{"Name": "IntimacyVI", "Type": 2, "Code": "assign 32"}]}` |
| Update7#98 | 33 | `{"Intimacy": {"Min": 16490, "Max": 17649}, "NextMtn": "Update8#98", "VarFloats": [{"Name": "IntimacyVI", "Type": 2, "Code": "assign 33"}]}` |
| Update7#98 | 34 | `{"Intimacy": {"Min": 17650, "Max": 18869}, "NextMtn": "Update8#98", "VarFloats": [{"Name": "IntimacyVI", "Type": 2, "Code": "assign 34"}]}` |
| Update7#98 | 35 | `{"Intimacy": {"Min": 18870, "Max": 20149}, "NextMtn": "Update8#98", "VarFloats": [{"Name": "IntimacyVI", "Type": 2, "Code": "assign 35"}]}` |
| Update7#98 | 36 | `{"Intimacy": {"Min": 20150, "Max": 21489}, "NextMtn": "Update8#98", "VarFloats": [{"Name": "IntimacyVI", "Type": 2, "Code": "assign 36"}]}` |
| Update7#98 | 37 | `{"Intimacy": {"Min": 21490, "Max": 22889}, "NextMtn": "Update8#98", "VarFloats": [{"Name": "IntimacyVI", "Type": 2, "Code": "assign 37"}]}` |
| Update7#98 | 38 | `{"Intimacy": {"Min": 22890, "Max": 24349}, "NextMtn": "Update8#98", "VarFloats": [{"Name": "IntimacyVI", "Type": 2, "Code": "assign 38"}]}` |
| Update7#98 | 39 | `{"Intimacy": {"Min": 24350, "Max": 25869}, "NextMtn": "Update8#98", "VarFloats": [{"Name": "IntimacyVI", "Type": 2, "Code": "assign 39"}]}` |
| Update7#98 | 40 | `{"Intimacy": {"Min": 25870, "Max": 27449}, "NextMtn": "Update8#98", "VarFloats": [{"Name": "IntimacyVI", "Type": 2, "Code": "assign 40"}]}` |
| Update7#98 | 41 | `{"Intimacy": {"Min": 27450, "Max": 30749}, "NextMtn": "Update8#98", "VarFloats": [{"Name": "IntimacyVI", "Type": 2, "Code": "assign 41"}]}` |
| Update7#98 | 42 | `{"Intimacy": {"Min": 30750, "Max": 34449}, "NextMtn": "Update8#98", "VarFloats": [{"Name": "IntimacyVI", "Type": 2, "Code": "assign 42"}]}` |
| Update7#98 | 43 | `{"Intimacy": {"Min": 34450, "Max": 38649}, "NextMtn": "Update8#98", "VarFloats": [{"Name": "IntimacyVI", "Type": 2, "Code": "assign 43"}]}` |
| Update7#98 | 44 | `{"Intimacy": {"Min": 38650, "Max": 43249}, "NextMtn": "Update8#98", "VarFloats": [{"Name": "IntimacyVI", "Type": 2, "Code": "assign 44"}]}` |
| Update7#98 | 45 | `{"Intimacy": {"Min": 43250, "Max": 48349}, "NextMtn": "Update8#98", "VarFloats": [{"Name": "IntimacyVI", "Type": 2, "Code": "assign 45"}]}` |
| Update7#98 | 46 | `{"Intimacy": {"Min": 48350, "Max": 53949}, "NextMtn": "Update8#98", "VarFloats": [{"Name": "IntimacyVI", "Type": 2, "Code": "assign 46"}]}` |
| Update7#98 | 47 | `{"Intimacy": {"Min": 53950, "Max": 60049}, "NextMtn": "Update8#98", "VarFloats": [{"Name": "IntimacyVI", "Type": 2, "Code": "assign 47"}]}` |
| Update7#98 | 48 | `{"Intimacy": {"Min": 60050, "Max": 66649}, "NextMtn": "Update8#98", "VarFloats": [{"Name": "IntimacyVI", "Type": 2, "Code": "assign 48"}]}` |
| Update7#98 | 49 | `{"Intimacy": {"Min": 66650, "Max": 73849}, "NextMtn": "Update8#98", "VarFloats": [{"Name": "IntimacyVI", "Type": 2, "Code": "assign 49"}]}` |
| Update7#98 | 50 | `{"Intimacy": {"Min": 73850}, "NextMtn": "Update8#98", "VarFloats": [{"Name": "IntimacyVI", "Type": 2, "Code": "assign 50"}]}` |
| Update8#98 | Update8_0 | `{"Text": "DebugText{$br}InBGMPlayer: {$vf_InBGMPlayer}{$br}InENV: {$vf_InENV}{$br}InRain: {$vf_InRain}{$br}InMouseTracking: {$vf_InMouseTracking}{$br}BGMTimer: {$vf_BGMTimer}{$br}ChatTimer: {$vf_ChatTimer}{$br}StopTimer: {$vf_StopTimer}{$br}BGMRepairTimer: {$vf_BGMRepairTimer}{$br}ENVRepairTimer: {$vf_ENVRepairTimer}{$br}OpenChat: {$vf_OpenChat}{$br}OpenBGM: {$vf_OpenBGM}{$br}StartOver: {$vf_StartOver}{$br}DoubleClickTimer: {$vf_DoubleClickTimer}{$br}InDebug: {$vf_InDebug}{$br}DragLock: {$vf_DragLock}{$br}InWeekend: {$vf_InWeekend}{$br}InValentine: {$vf_InValentine}{$br}WhisperType: {$vf_WhisperType}{$br}WhisperTimer: {$vf_WhisperTimer}{$br}WhisperStep: {$vf_WhisperStep}{$br}好感度: {$intimacy}{$br}timenow: {$timenow}", "TextDuration": 1000, "NextMtn": "Update9#98", "Weight": 999, "VarFloats": [{"Name": "InDebug", "Type": 1, "Code": "equal 1"}]}` |
| Update8#98 | Update8_1 | `{"NextMtn": "Update9#98"}` |
| 送礼菜单#99 | 送礼菜单 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "送礼", "Choices": [{"Text": "随机送礼", "NextMtn": "随机送礼"}, {"Text": "食物-白色", "NextMtn": "送礼菜单-白色食物#99"}, {"Text": "食物-绿色", "NextMtn": "送礼菜单-绿色食物#99"}, {"Text": "食物-蓝色", "NextMtn": "送礼菜单-蓝色食物#99"}, {"Text": "食物-紫色", "NextMtn": "送礼菜单-紫色食物#99"}, {"Text": "礼物-白色", "NextMtn": "送礼菜单-白色礼物#99"}, {"Text": "礼物-绿色", "NextMtn": "送礼菜单-绿色礼物#99"}, {"Text": "礼物-蓝色", "NextMtn": "送礼菜单-蓝色礼物#99"}, {"Text": "礼物-紫色", "NextMtn": "送礼菜单-紫色礼物#99"}], "TextDuration": 5000}` |
| 送礼菜单#99 | 送礼菜单 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "Gift", "Choices": [{"Text": "Random Gift", "NextMtn": "随机送礼"}, {"Text": "Food-White", "NextMtn": "送礼菜单-白色食物#99"}, {"Text": "Food-Green", "NextMtn": "送礼菜单-绿色食物#99"}, {"Text": "Food-Blue", "NextMtn": "送礼菜单-蓝色食物#99"}, {"Text": "Food-Purple", "NextMtn": "送礼菜单-紫色食物#99"}, {"Text": "Gift-White", "NextMtn": "送礼菜单-白色礼物#99"}, {"Text": "Gift-Green", "NextMtn": "送礼菜单-绿色礼物#99"}, {"Text": "Gift-Blue", "NextMtn": "送礼菜单-蓝色礼物#99"}, {"Text": "Gift-Purple", "NextMtn": "送礼菜单-紫色礼物#99"}], "TextDuration": 5000, "Language": "en"}` |
| 礼物-喜欢 | 礼物-节日 | `{"Command": "start_mtn 礼物-节日", "Intimacy": {"Min": 6350}, "Weight": 3, "VarFloats": [{"Name": "DateFlag", "Type": 1, "Code": "greater_equal 4"}]}` |
| 送礼菜单-白色食物#99 | 送礼菜单-白色食物 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "食物-白色", "Choices": [{"Text": "炝炒蔬菜-普通", "NextMtn": "送礼#99:炝炒蔬菜"}, {"Text": "热水-讨厌", "NextMtn": "送礼#99:热水"}, {"Text": "水果拼盘-普通", "NextMtn": "送礼#99:水果拼盘"}, {"Text": "热牛奶-普通", "NextMtn": "送礼#99:热牛奶"}, {"Text": "海鲜焗饭-喜欢", "NextMtn": "送礼#99:海鲜焗饭"}, {"Text": "虎皮辣椒-讨厌", "NextMtn": "送礼#99:虎皮辣椒"}, {"Text": "蜂蜜烤鱼-讨厌", "NextMtn": "送礼#99:蜂蜜烤鱼"}, {"Text": "馒头-讨厌", "NextMtn": "送礼#99:馒头"}, {"Text": "香辣烤肉-普通", "NextMtn": "送礼#99:香辣烤肉"}, {"Text": "辣条-讨厌", "NextMtn": "送礼#99:辣条"}], "TextDuration": 5000}` |
| 送礼菜单-白色食物#99 | 送礼菜单-白色食物 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "Food-White", "Choices": [{"Text": "Stir-fried vegetables-Midlike", "NextMtn": "送礼#99:炝炒蔬菜"}, {"Text": "Hot water-Dislike", "NextMtn": "送礼#99:热水"}, {"Text": "Fruit platter-Midlike", "NextMtn": "送礼#99:水果拼盘"}, {"Text": "Hot milk-Midlike", "NextMtn": "送礼#99:热牛奶"}, {"Text": "Seafood baked rice-Like", "NextMtn": "送礼#99:海鲜焗饭"}, {"Text": "虎皮辣椒-Dislike", "NextMtn": "送礼#99:虎皮辣椒"}, {"Text": "Honey baked fish-Dislike", "NextMtn": "送礼#99:蜂蜜烤鱼"}, {"Text": "Steamed bun-Dislike", "NextMtn": "送礼#99:馒头"}, {"Text": "Spicy grilled pork-Midlike", "NextMtn": "送礼#99:香辣烤肉"}, {"Text": "Spicy stick-Dislike", "NextMtn": "送礼#99:辣条"}], "TextDuration": 5000, "Language": "en"}` |
| 送礼菜单-绿色食物#99 | 送礼菜单-绿色食物 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "食物-绿色", "Choices": [{"Text": "蔬菜炒饭-讨厌", "NextMtn": "送礼#99:蔬菜炒饭"}, {"Text": "糖果-喜欢", "NextMtn": "送礼#99:糖果"}, {"Text": "营养煨炖-普通", "NextMtn": "送礼#99:营养煨炖"}, {"Text": "香煎三文鱼-喜欢", "NextMtn": "送礼#99:香煎三文鱼"}, {"Text": "海鲜汤-喜欢", "NextMtn": "送礼#99:海鲜汤"}, {"Text": "甜饭团-普通", "NextMtn": "送礼#99:甜饭团"}, {"Text": "刺身拼盘-普通", "NextMtn": "送礼#99:刺身拼盘"}, {"Text": "水果蜜饯-喜欢", "NextMtn": "送礼#99:水果蜜饯"}, {"Text": "蜂蜜烧烤-讨厌", "NextMtn": "送礼#99:蜂蜜烧烤"}, {"Text": "冰镇果汁-喜欢", "NextMtn": "送礼#99:冰镇果汁"}], "TextDuration": 5000}` |
| 送礼菜单-绿色食物#99 | 送礼菜单-绿色食物 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "Food-Green", "Choices": [{"Text": "Vegetable Fried Rice-Dislike", "NextMtn": "送礼#99:蔬菜炒饭"}, {"Text": "Candy-Like", "NextMtn": "送礼#99:糖果"}, {"Text": "Nutritious Stew-Midlike", "NextMtn": "送礼#99:营养煨炖"}, {"Text": "Pan-fried Salmon-Like", "NextMtn": "送礼#99:香煎三文鱼"}, {"Text": "Seafood Soup-Like", "NextMtn": "送礼#99:海鲜汤"}, {"Text": "Sweet rice balls-Midlike", "NextMtn": "送礼#99:甜饭团"}, {"Text": "Sashimi platter-Midlike", "NextMtn": "送礼#99:刺身拼盘"}, {"Text": "Fruit preserves-Like", "NextMtn": "送礼#99:水果蜜饯"}, {"Text": "Honey grill-Dislike", "NextMtn": "送礼#99:蜂蜜烧烤"}, {"Text": "Chilled juice-Like", "NextMtn": "送礼#99:冰镇果汁"}], "TextDuration": 5000, "Language": "en"}` |
| 送礼菜单-蓝色食物#99 | 送礼菜单-蓝色食物 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "食物-蓝色", "Choices": [{"Text": "水果冰淇淋-普通", "NextMtn": "送礼#99:水果冰淇淋"}, {"Text": "蜂蜜牛奶-普通", "NextMtn": "送礼#99:蜂蜜牛奶"}, {"Text": "奶油面包-普通", "NextMtn": "送礼#99:奶油面包"}, {"Text": "果蔬沙拉-普通", "NextMtn": "送礼#99:果蔬沙拉"}, {"Text": "蘑菇肉串-普通", "NextMtn": "送礼#99:蘑菇肉串"}, {"Text": "滑肉粥-普通", "NextMtn": "送礼#99:滑肉粥"}, {"Text": "三文鱼寿司-普通", "NextMtn": "送礼#99:三文鱼寿司"}, {"Text": "水果咕噜肉-讨厌", "NextMtn": "送礼#99:水果咕噜肉"}, {"Text": "什锦海鲜-喜欢", "NextMtn": "送礼#99:什锦海鲜"}, {"Text": "炖肉-普通", "NextMtn": "送礼#99:炖肉"}], "TextDuration": 5000}` |
| 送礼菜单-蓝色食物#99 | 送礼菜单-蓝色食物 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "Food-Blue", "Choices": [{"Text": "Fruit ice cream-Midlike", "NextMtn": "送礼#99:水果冰淇淋"}, {"Text": "Honey milk-Midlike", "NextMtn": "送礼#99:蜂蜜牛奶"}, {"Text": "Creamy bread-Midlike", "NextMtn": "送礼#99:奶油面包"}, {"Text": "Fruit and vegetable salad-Midlike", "NextMtn": "送礼#99:果蔬沙拉"}, {"Text": "Mushroom kebab-Midlike", "NextMtn": "送礼#99:蘑菇肉串"}, {"Text": "Meat porridge-Midlike", "NextMtn": "送礼#99:滑肉粥"}, {"Text": "Salmon sushi-Midlike", "NextMtn": "送礼#99:三文鱼寿司"}, {"Text": "Fruit goulash-Dislike", "NextMtn": "送礼#99:水果咕噜肉"}, {"Text": "Mixed seafood-Like", "NextMtn": "送礼#99:什锦海鲜"}, {"Text": "Meat stew-Midlike", "NextMtn": "送礼#99:炖肉"}], "TextDuration": 5000, "Language": "en"}` |
| 送礼菜单-紫色食物#99 | 送礼菜单-紫色食物 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "食物-紫色", "Choices": [{"Text": "牛奶冰淇淋-普通", "NextMtn": "送礼#99:牛奶冰淇淋"}, {"Text": "麻辣烤鱼-讨厌", "NextMtn": "送礼#99:麻辣烤鱼"}, {"Text": "果肉炒饭-讨厌", "NextMtn": "送礼#99:果肉炒饭"}, {"Text": "炖鱼-普通", "NextMtn": "送礼#99:炖鱼"}, {"Text": "仰望星空派-喜欢", "NextMtn": "送礼#99:仰望星空派"}, {"Text": "蜂蜜烤菜-讨厌", "NextMtn": "送礼#99:蜂蜜烤菜"}, {"Text": "战斧牛排-普通", "NextMtn": "送礼#99:战斧牛排"}, {"Text": "水果蛋糕-喜欢", "NextMtn": "送礼#99:水果蛋糕"}, {"Text": "烤肉拼盘-普通", "NextMtn": "送礼#99:烤肉拼盘"}, {"Text": "蘑菇浓汤-普通", "NextMtn": "送礼#99:蘑菇浓汤"}], "TextDuration": 5000}` |
| 送礼菜单-紫色食物#99 | 送礼菜单-紫色食物 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "Food-Purple", "Choices": [{"Text": "Milk ice cream-Midlike", "NextMtn": "送礼#99:牛奶冰淇淋"}, {"Text": "Spicy grilled fish-Dislike", "NextMtn": "送礼#99:麻辣烤鱼"}, {"Text": "Fruit fried rice-Dislike", "NextMtn": "送礼#99:果肉炒饭"}, {"Text": "Fish stew-Midlike", "NextMtn": "送礼#99:炖鱼"}, {"Text": "Stargazing pie-Like", "NextMtn": "送礼#99:仰望星空派"}, {"Text": "Honey roasted vegetables-Dislike", "NextMtn": "送礼#99:蜂蜜烤菜"}, {"Text": "Tomahawk steak-Midlike", "NextMtn": "送礼#99:战斧牛排"}, {"Text": "Fruit cake-Like", "NextMtn": "送礼#99:水果蛋糕"}, {"Text": "Grilled meat platter-Midlike", "NextMtn": "送礼#99:烤肉拼盘"}, {"Text": "Mushroom soup-Midlike", "NextMtn": "送礼#99:蘑菇浓汤"}], "TextDuration": 5000, "Language": "en"}` |
| 送礼菜单-白色礼物#99 | 送礼菜单-白色礼物 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "礼物-白色", "Choices": [{"Text": "蕾丝发带-喜欢", "NextMtn": "送礼#99:蕾丝发带"}, {"Text": "干花香包-普通", "NextMtn": "送礼#99:干花香包"}, {"Text": "战术要义-讨厌", "NextMtn": "送礼#99:战术要义"}, {"Text": "卢纳书-讨厌", "NextMtn": "送礼#99:卢纳书"}, {"Text": "彩色墨水-讨厌", "NextMtn": "送礼#99:彩色墨水"}, {"Text": "童话绘本-普通", "NextMtn": "送礼#99:童话绘本"}, {"Text": "护身符-普通", "NextMtn": "送礼#99:护身符"}, {"Text": "宽檐帽-喜欢", "NextMtn": "送礼#99:宽檐帽"}, {"Text": "探索手册-普通", "NextMtn": "送礼#99:探索手册"}], "TextDuration": 5000}` |
| 送礼菜单-白色礼物#99 | 送礼菜单-白色礼物 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "Gift-White", "Choices": [{"Text": "Lace hairband-Like", "NextMtn": "送礼#99:蕾丝发带"}, {"Text": "Dried flower scent bag-Midlike", "NextMtn": "送礼#99:干花香包"}, {"Text": "Tactical essentials-Dislike", "NextMtn": "送礼#99:战术要义"}, {"Text": "Luna book-Dislike", "NextMtn": "送礼#99:卢纳书"}, {"Text": "Colored ink-Dislike", "NextMtn": "送礼#99:彩色墨水"}, {"Text": "Fairy tale picture book-Midlike", "NextMtn": "送礼#99:童话绘本"}, {"Text": "Amulet-Midlike", "NextMtn": "送礼#99:护身符"}, {"Text": "Wide brimmed hat-Like", "NextMtn": "送礼#99:宽檐帽"}, {"Text": "Exploration manual-Midlike", "NextMtn": "送礼#99:探索手册"}], "TextDuration": 5000, "Language": "en"}` |
| 送礼菜单-绿色礼物#99 | 送礼菜单-绿色礼物 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "礼物-绿色", "Choices": [{"Text": "沙漏-讨厌", "NextMtn": "送礼#99:沙漏"}, {"Text": "新月诗集-讨厌", "NextMtn": "送礼#99:新月诗集"}, {"Text": "种植指南-普通", "NextMtn": "送礼#99:种植指南"}, {"Text": "怪异事典-普通", "NextMtn": "送礼#99:怪异事典"}, {"Text": "短刃匕首-喜欢", "NextMtn": "送礼#99:短刃匕首"}, {"Text": "铁制锁链-喜欢", "NextMtn": "送礼#99:铁制锁链"}, {"Text": "诸神传说-讨厌", "NextMtn": "送礼#99:诸神传说"}, {"Text": "陶瓷茶杯-普通", "NextMtn": "送礼#99:陶瓷茶杯"}, {"Text": "羽毛笔-喜欢", "NextMtn": "送礼#99:羽毛笔"}, {"Text": "中秋月饼-喜欢", "NextMtn": "送礼#99:中秋月饼"}, {"Text": "爱意玫瑰-喜欢", "NextMtn": "送礼#99:爱意玫瑰"}, {"Text": "纯白花束-喜欢", "NextMtn": "送礼#99:纯白花束"}, {"Text": "幸运饼干-喜欢", "NextMtn": "送礼#99:幸运饼干"}, {"Text": "纯白花束-喜欢", "NextMtn": "送礼#99:纯白花束"}], "TextDuration": 5000}` |
| 送礼菜单-绿色礼物#99 | 送礼菜单-绿色礼物 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "Gift-Green", "Choices": [{"Text": "Hourglass-Dislike", "NextMtn": "送礼#99:沙漏"}, {"Text": "New Moon Poetry-Dislike", "NextMtn": "送礼#99:新月诗集"}, {"Text": "Planting Guide-Midlike", "NextMtn": "送礼#99:种植指南"}, {"Text": "Dictionary of Weird Things-Midlike", "NextMtn": "送礼#99:怪异事典"}, {"Text": "Short Bladed Dagger-Like", "NextMtn": "送礼#99:短刃匕首"}, {"Text": "Iron Chains-Like", "NextMtn": "送礼#99:铁制锁链"}, {"Text": "Legend of the Gods-Dislike", "NextMtn": "送礼#99:诸神传说"}, {"Text": "Ceramic Teacup-Midlike", "NextMtn": "送礼#99:陶瓷茶杯"}, {"Text": "Quill-Like", "NextMtn": "送礼#99:羽毛笔"}, {"Text": "Mid-Autumn Mooncakes-Like", "NextMtn": "送礼#99:中秋月饼"}, {"Text": "Love Roses-Like", "NextMtn": "送礼#99:爱意玫瑰"}, {"Text": "Pure White Bouquet-Like", "NextMtn": "送礼#99:纯白花束"}, {"Text": "Fortune Cookies-Like", "NextMtn": "送礼#99:幸运饼干"}, {"Text": "Pure White Bouquet-Like", "NextMtn": "送礼#99:纯白花束"}], "TextDuration": 5000, "Language": "en"}` |
| 送礼菜单-蓝色礼物#99 | 送礼菜单-蓝色礼物 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "礼物-蓝色", "Choices": [{"Text": "公国画册-普通", "NextMtn": "送礼#99:公国画册"}, {"Text": "修理套件-普通", "NextMtn": "送礼#99:修理套件"}, {"Text": "女神塑像-讨厌", "NextMtn": "送礼#99:女神塑像"}, {"Text": "远古法典-讨厌", "NextMtn": "送礼#99:远古法典"}, {"Text": "骑士长剑-喜欢", "NextMtn": "送礼#99:骑士长剑"}, {"Text": "卢纳公报-讨厌", "NextMtn": "送礼#99:卢纳公报"}, {"Text": "食谱集-普通", "NextMtn": "送礼#99:食谱集"}, {"Text": "乐谱手稿-讨厌", "NextMtn": "送礼#99:乐谱手稿"}], "TextDuration": 5000}` |
| 送礼菜单-蓝色礼物#99 | 送礼菜单-蓝色礼物 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "Gift-Blue", "Choices": [{"Text": "Principality Album-Midlike", "NextMtn": "送礼#99:公国画册"}, {"Text": "Repair Kit-Midlike", "NextMtn": "送礼#99:修理套件"}, {"Text": "Goddess Statue-Dislike", "NextMtn": "送礼#99:女神塑像"}, {"Text": "Ancient Codex-Dislike", "NextMtn": "送礼#99:远古法典"}, {"Text": "Knight's Rapier-Like", "NextMtn": "送礼#99:骑士长剑"}, {"Text": "Luna Bulletin-Dislike", "NextMtn": "送礼#99:卢纳公报"}, {"Text": "Recipe Book-Midlike", "NextMtn": "送礼#99:食谱集"}, {"Text": "Music Manuscript-Dislike", "NextMtn": "送礼#99:乐谱手稿"}], "TextDuration": 5000, "Language": "en"}` |
| 送礼菜单-紫色礼物#99 | 送礼菜单-紫色礼物 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "礼物-紫色", "Choices": [{"Text": "香水-喜欢", "NextMtn": "送礼#99:香水"}, {"Text": "珍珠手链-喜欢", "NextMtn": "送礼#99:珍珠手链"}, {"Text": "帝国枪械-喜欢", "NextMtn": "送礼#99:帝国枪械"}, {"Text": "水晶球-普通", "NextMtn": "送礼#99:水晶球"}, {"Text": "红刚玉-普通", "NextMtn": "送礼#99:红刚玉"}, {"Text": "望远镜-普通", "NextMtn": "送礼#99:望远镜"}, {"Text": "兽牙项链-喜欢", "NextMtn": "送礼#99:兽牙项链"}, {"Text": "制式服装-喜欢", "NextMtn": "送礼#99:制式服装"}, {"Text": "梦幻蛋糕-喜欢", "NextMtn": "送礼#99:梦幻蛋糕"}, {"Text": "丝织手绢-喜欢", "NextMtn": "送礼#99:丝织手绢"}], "TextDuration": 5000}` |
| 送礼菜单-紫色礼物#99 | 送礼菜单-紫色礼物 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "Gift-Purple", "Choices": [{"Text": "Perfume-Like", "NextMtn": "送礼#99:香水"}, {"Text": "Pearl Bracelet-Like", "NextMtn": "送礼#99:珍珠手链"}, {"Text": "Imperial Firearm-Like", "NextMtn": "送礼#99:帝国枪械"}, {"Text": "Crystal Ball-Midlike", "NextMtn": "送礼#99:水晶球"}, {"Text": "Red Corundum-Midlike", "NextMtn": "送礼#99:红刚玉"}, {"Text": "Telescope-Midlike", "NextMtn": "送礼#99:望远镜"}, {"Text": "Beast's Tooth Necklace-Like", "NextMtn": "送礼#99:兽牙项链"}, {"Text": "Costume-Like", "NextMtn": "送礼#99:制式服装"}, {"Text": "Dream Cake-Like", "NextMtn": "送礼#99:梦幻蛋糕"}, {"Text": "丝织手绢-Like", "NextMtn": "送礼#99:丝织手绢"}], "TextDuration": 5000, "Language": "en"}` |
| 送礼#99 | 蕾丝发带 | `{"Intimacy": {"Bonus": 40}, "NextMtn": "喜爱礼物"}` |
| 送礼#99 | 干花香包 | `{"Intimacy": {"Bonus": 34}, "NextMtn": "礼物:礼物-一般"}` |
| 送礼#99 | 战术要义 | `{"Intimacy": {}, "NextMtn": "礼物:礼物-讨厌"}` |
| 送礼#99 | 卢纳书 | `{"Intimacy": {}, "NextMtn": "礼物:礼物-讨厌"}` |
| 送礼#99 | 彩色墨水 | `{"Intimacy": {}, "NextMtn": "礼物:礼物-讨厌"}` |
| 送礼#99 | 童话绘本 | `{"Intimacy": {"Bonus": 34}, "NextMtn": "礼物:礼物-一般"}` |
| 送礼#99 | 护身符 | `{"Intimacy": {"Bonus": 34}, "NextMtn": "礼物:礼物-一般"}` |
| 送礼#99 | 宽檐帽 | `{"Intimacy": {"Bonus": 40}, "NextMtn": "喜爱礼物"}` |
| 送礼#99 | 探索手册 | `{"Intimacy": {"Bonus": 34}, "NextMtn": "礼物:礼物-一般"}` |
| 送礼#99 | 沙漏 | `{"Intimacy": {}, "NextMtn": "礼物:礼物-讨厌"}` |
| 送礼#99 | 新月诗集 | `{"Intimacy": {}, "NextMtn": "礼物:礼物-讨厌"}` |
| 送礼#99 | 种植指南 | `{"Intimacy": {"Bonus": 85}, "NextMtn": "礼物:礼物-一般"}` |
| 送礼#99 | 怪异事典 | `{"Intimacy": {"Bonus": 85}, "NextMtn": "礼物:礼物-一般"}` |
| 送礼#99 | 短刃匕首 | `{"Intimacy": {"Bonus": 100}, "NextMtn": "喜爱礼物"}` |
| 送礼#99 | 铁制锁链 | `{"Intimacy": {"Bonus": 100}, "NextMtn": "喜爱礼物"}` |
| 送礼#99 | 诸神传说 | `{"Intimacy": {}, "NextMtn": "礼物:礼物-讨厌"}` |
| 送礼#99 | 陶瓷茶杯 | `{"Intimacy": {"Bonus": 85}, "NextMtn": "礼物:礼物-一般"}` |
| 送礼#99 | 羽毛笔 | `{"Intimacy": {"Bonus": 100}, "NextMtn": "喜爱礼物"}` |
| 送礼#99 | 中秋月饼 | `{"Intimacy": {"Bonus": 100}, "NextMtn": "喜爱礼物"}` |
| 送礼#99 | 爱意玫瑰 | `{"Intimacy": {"Bonus": 100}, "NextMtn": "喜爱礼物"}` |
| 送礼#99 | 纯白花束 | `{"Intimacy": {"Bonus": 100}, "NextMtn": "喜爱礼物"}` |
| 送礼#99 | 幸运饼干 | `{"Intimacy": {"Bonus": 100}, "NextMtn": "喜爱礼物"}` |
| 送礼#99 | 纯白花束 | `{"Intimacy": {"Bonus": 100}, "NextMtn": "喜爱礼物"}` |
| 送礼#99 | 公国画册 | `{"Intimacy": {"Bonus": 136}, "NextMtn": "礼物:礼物-一般"}` |
| 送礼#99 | 修理套件 | `{"Intimacy": {"Bonus": 136}, "NextMtn": "礼物:礼物-一般"}` |
| 送礼#99 | 女神塑像 | `{"Intimacy": {}, "NextMtn": "礼物:礼物-讨厌"}` |
| 送礼#99 | 远古法典 | `{"Intimacy": {}, "NextMtn": "礼物:礼物-讨厌"}` |
| 送礼#99 | 骑士长剑 | `{"Intimacy": {"Bonus": 160}, "NextMtn": "喜爱礼物"}` |
| 送礼#99 | 卢纳公报 | `{"Intimacy": {}, "NextMtn": "礼物:礼物-讨厌"}` |
| 送礼#99 | 食谱集 | `{"Intimacy": {"Bonus": 136}, "NextMtn": "礼物:礼物-一般"}` |
| 送礼#99 | 乐谱手稿 | `{"Intimacy": {}, "NextMtn": "礼物:礼物-讨厌"}` |
| 送礼#99 | 香水 | `{"Intimacy": {"Bonus": 300}, "NextMtn": "喜爱礼物"}` |
| 送礼#99 | 珍珠手链 | `{"Intimacy": {"Bonus": 300}, "NextMtn": "喜爱礼物"}` |
| 送礼#99 | 帝国枪械 | `{"Intimacy": {"Bonus": 300}, "NextMtn": "喜爱礼物"}` |
| 送礼#99 | 水晶球 | `{"Intimacy": {"Bonus": 255}, "NextMtn": "礼物:礼物-一般"}` |
| 送礼#99 | 红刚玉 | `{"Intimacy": {"Bonus": 255}, "NextMtn": "礼物:礼物-一般"}` |
| 送礼#99 | 望远镜 | `{"Intimacy": {"Bonus": 255}, "NextMtn": "礼物:礼物-一般"}` |
| 送礼#99 | 兽牙项链 | `{"Intimacy": {"Bonus": 300}, "NextMtn": "喜爱礼物"}` |
| 送礼#99 | 制式服装 | `{"Intimacy": {"Bonus": 300}, "NextMtn": "喜爱礼物"}` |
| 送礼#99 | 梦幻蛋糕 | `{"Intimacy": {"Bonus": 300}, "NextMtn": "喜爱礼物"}` |
| 送礼#99 | 丝织手绢 | `{"Intimacy": {"Bonus": 300}, "NextMtn": "喜爱礼物"}` |
| 送礼#99 | 炝炒蔬菜 | `{"Intimacy": {"Bonus": 68}, "NextMtn": "食物:食物-一般2"}` |
| 送礼#99 | 热水 | `{"Intimacy": {}, "NextMtn": "食物:食物-讨厌2"}` |
| 送礼#99 | 水果拼盘 | `{"Intimacy": {"Bonus": 68}, "NextMtn": "食物:食物-一般2"}` |
| 送礼#99 | 热牛奶 | `{"Intimacy": {"Bonus": 68}, "NextMtn": "食物:食物-一般1"}` |
| 送礼#99 | 海鲜焗饭 | `{"Intimacy": {"Bonus": 80}, "NextMtn": "食物:食物-喜欢1"}` |
| 送礼#99 | 虎皮辣椒 | `{"Intimacy": {}, "NextMtn": "食物:食物-讨厌2"}` |
| 送礼#99 | 蜂蜜烤鱼 | `{"Intimacy": {}, "NextMtn": "食物:食物-讨厌2"}` |
| 送礼#99 | 馒头 | `{"Intimacy": {}, "NextMtn": "食物:食物-讨厌2"}` |
| 送礼#99 | 香辣烤肉 | `{"Intimacy": {"Bonus": 68}, "NextMtn": "食物:食物-一般3"}` |
| 送礼#99 | 辣条 | `{"Intimacy": {}, "NextMtn": "食物:食物-讨厌1"}` |
| 送礼#99 | 蔬菜炒饭 | `{"Intimacy": {}, "NextMtn": "食物:食物-讨厌1"}` |
| 送礼#99 | 糖果 | `{"Intimacy": {"Bonus": 140}, "NextMtn": "食物:食物-喜欢2"}` |
| 送礼#99 | 营养煨炖 | `{"Intimacy": {"Bonus": 119}, "NextMtn": "食物:食物-一般1"}` |
| 送礼#99 | 香煎三文鱼 | `{"Intimacy": {"Bonus": 140}, "NextMtn": "食物:食物-喜欢2"}` |
| 送礼#99 | 海鲜汤 | `{"Intimacy": {"Bonus": 140}, "NextMtn": "食物:食物-喜欢2"}` |
| 送礼#99 | 甜饭团 | `{"Intimacy": {"Bonus": 119}, "NextMtn": "食物:食物-一般1"}` |
| 送礼#99 | 刺身拼盘 | `{"Intimacy": {"Bonus": 119}, "NextMtn": "食物:食物-特殊1"}` |
| 送礼#99 | 水果蜜饯 | `{"Intimacy": {"Bonus": 140}, "NextMtn": "食物:食物-喜欢2"}` |
| 送礼#99 | 蜂蜜烧烤 | `{"Intimacy": {}, "NextMtn": "食物:食物-讨厌2"}` |
| 送礼#99 | 冰镇果汁 | `{"Intimacy": {"Bonus": 140}, "NextMtn": "食物:食物-喜欢1"}` |
| 送礼#99 | 水果冰淇淋 | `{"Intimacy": {"Bonus": 140}, "NextMtn": "食物:食物-特殊2"}` |
| 送礼#99 | 蜂蜜牛奶 | `{"Intimacy": {"Bonus": 140}, "NextMtn": "食物:食物-一般1"}` |
| 送礼#99 | 奶油面包 | `{"Intimacy": {"Bonus": 140}, "NextMtn": "食物:食物-一般1"}` |
| 送礼#99 | 果蔬沙拉 | `{"Intimacy": {"Bonus": 140}, "NextMtn": "食物:食物-一般2"}` |
| 送礼#99 | 蘑菇肉串 | `{"Intimacy": {"Bonus": 140}, "NextMtn": "食物:食物-一般3"}` |
| 送礼#99 | 滑肉粥 | `{"Intimacy": {"Bonus": 140}, "NextMtn": "食物:食物-一般1"}` |
| 送礼#99 | 三文鱼寿司 | `{"Intimacy": {"Bonus": 140}, "NextMtn": "食物:食物-特殊1"}` |
| 送礼#99 | 水果咕噜肉 | `{"Intimacy": {}, "NextMtn": "食物:食物-讨厌1"}` |
| 送礼#99 | 什锦海鲜 | `{"Intimacy": {"Bonus": 200}, "NextMtn": "食物:食物-喜欢2"}` |
| 送礼#99 | 炖肉 | `{"Intimacy": {"Bonus": 140}, "NextMtn": "食物:食物-一般1"}` |
| 送礼#99 | 牛奶冰淇淋 | `{"Intimacy": {"Bonus": 224}, "NextMtn": "食物:食物-特殊2"}` |
| 送礼#99 | 麻辣烤鱼 | `{"Intimacy": {}, "NextMtn": "食物:食物-讨厌1"}` |
| 送礼#99 | 果肉炒饭 | `{"Intimacy": {}, "NextMtn": "食物:食物-讨厌2"}` |
| 送礼#99 | 炖鱼 | `{"Intimacy": {"Bonus": 224}, "NextMtn": "食物:食物-一般1"}` |
| 送礼#99 | 仰望星空派 | `{"Intimacy": {"Bonus": 320}, "NextMtn": "食物:食物-喜欢1"}` |
| 送礼#99 | 蜂蜜烤菜 | `{"Intimacy": {}, "NextMtn": "食物:食物-讨厌1"}` |
| 送礼#99 | 战斧牛排 | `{"Intimacy": {"Bonus": 224}, "NextMtn": "食物:食物-一般2"}` |
| 送礼#99 | 水果蛋糕 | `{"Intimacy": {"Bonus": 320}, "NextMtn": "食物:食物-喜欢1"}` |
| 送礼#99 | 烤肉拼盘 | `{"Intimacy": {"Bonus": 224}, "NextMtn": "食物:食物-一般3"}` |
| 送礼#99 | 蘑菇浓汤 | `{"Intimacy": {"Bonus": 224}, "NextMtn": "食物:食物-一般1"}` |
| 动作菜单#99 | 动作菜单 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "动作菜单", "Choices": [{"Text": "闲聊动作", "NextMtn": "闲聊菜单#99"}, {"Text": "触摸动作", "NextMtn": "触摸菜单#99"}, {"Text": "送礼动作", "NextMtn": "主动送礼菜单#99"}, {"Text": "Pose动作", "NextMtn": "Pose菜单#99"}], "TextDuration": 5000}` |
| 动作菜单#99 | 动作菜单 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "Motion Menu", "Choices": [{"Text": "Chat Motion", "NextMtn": "闲聊菜单#99"}, {"Text": "Touch Motion", "NextMtn": "触摸菜单#99"}, {"Text": "Gift Motion", "NextMtn": "主动送礼菜单#99"}, {"Text": "Gift Motion", "NextMtn": "Pose菜单#99"}], "TextDuration": 5000, "Language": "en"}` |
| 闲聊菜单#99 | 闲聊菜单 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "闲聊动作", "Choices": [{"Text": "随机闲聊", "NextMtn": "Chat"}, {"Text": "闲聊-基础", "NextMtn": "闲聊菜单-闲聊-基础#99"}, {"Text": "闲聊-其他", "NextMtn": "闲聊菜单-闲聊-其他#99"}, {"Text": "问候-上午", "NextMtn": "闲聊菜单-问候-上午#99"}, {"Text": "问候-下午", "NextMtn": "闲聊菜单-问候-下午#99"}, {"Text": "问候-晚上", "NextMtn": "闲聊菜单-问候-晚上#99"}, {"Text": "问候-深夜", "NextMtn": "闲聊菜单-问候-深夜#99"}, {"Text": "问候-周末", "NextMtn": "闲聊菜单-问候-周末#99"}, {"Text": "问候-节日", "NextMtn": "闲聊菜单-问候-节日#99"}, {"Text": "私语", "NextMtn": "闲聊菜单-私语#99"}], "TextDuration": 5000}` |
| 闲聊菜单#99 | 闲聊菜单 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "Chat Motion", "Choices": [{"Text": "Random Chat", "NextMtn": "Chat"}, {"Text": "Chat-Base", "NextMtn": "闲聊菜单-闲聊-基础#99"}, {"Text": "Chat-Other", "NextMtn": "闲聊菜单-闲聊-其他#99"}, {"Text": "Greet-Morning", "NextMtn": "闲聊菜单-问候-上午#99"}, {"Text": "Greet-Noon", "NextMtn": "闲聊菜单-问候-下午#99"}, {"Text": "Greet-Night", "NextMtn": "闲聊菜单-问候-晚上#99"}, {"Text": "Greet-Midnight", "NextMtn": "闲聊菜单-问候-深夜#99"}, {"Text": "Greet-Weekend", "NextMtn": "闲聊菜单-问候-周末#99"}, {"Text": "Greet-Festival", "NextMtn": "闲聊菜单-问候-节日#99"}, {"Text": "Whisper", "NextMtn": "闲聊菜单-私语#99"}], "TextDuration": 5000, "Language": "en"}` |
| 闲聊菜单-闲聊-基础#99 | 闲聊菜单-闲聊-基础 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "闲聊-基础", "Choices": [{"Text": "闲聊1", "NextMtn": "ActiveChat:闲聊1"}, {"Text": "闲聊2", "NextMtn": "ActiveChat:闲聊2"}, {"Text": "闲聊3", "NextMtn": "ActiveChat:闲聊3"}, {"Text": "闲聊4", "NextMtn": "ActiveChat:闲聊4"}, {"Text": "闲聊5", "NextMtn": "ActiveChat:闲聊5"}], "TextDuration": 5000}` |
| 闲聊菜单-闲聊-基础#99 | 闲聊菜单-闲聊-基础 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "Chat-Base", "Choices": [{"Text": "Chat 1", "NextMtn": "ActiveChat:闲聊1"}, {"Text": "Chat 2", "NextMtn": "ActiveChat:闲聊2"}, {"Text": "Chat 3", "NextMtn": "ActiveChat:闲聊3"}, {"Text": "Chat 4", "NextMtn": "ActiveChat:闲聊4"}, {"Text": "Chat 5", "NextMtn": "ActiveChat:闲聊5"}], "TextDuration": 5000, "Language": "en"}` |
| 闲聊菜单-闲聊-其他#99 | 闲聊菜单-闲聊-其他 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "闲聊-其他", "Choices": [{"Text": "闲聊-特殊", "NextMtn": "ActiveChat:闲聊-特殊"}, {"Text": "闲聊-喜欢的东西", "NextMtn": "ActiveChat:闲聊-喜欢的东西"}, {"Text": "闲聊-讨厌的东西", "NextMtn": "ActiveChat:闲聊-讨厌的东西"}, {"Text": "闲聊-对新月大陆的看法", "NextMtn": "ActiveChat:闲聊-对新月大陆的看法"}, {"Text": "闲聊-同伴印象", "NextMtn": "ActiveChat:闲聊-同伴印象"}, {"Text": "闲聊-过去的自己", "NextMtn": "ActiveChat:闲聊-过去的自己"}, {"Text": "闲聊-誓约", "NextMtn": "ActiveChat:闲聊-誓约"}, {"Text": "问候-誓约", "NextMtn": "ActiveChat:问候-誓约"}, {"Text": "好感度提升", "NextMtn": "ActiveChat:好感度提升"}, {"Text": "誓约", "NextMtn": "ActiveChat:誓约"}, {"Text": "闲聊-不开心", "NextMtn": "ActiveChat:闲聊-不开心"}, {"Text": "问候-不开心", "NextMtn": "ActiveChat:问候-不开心"}, {"Text": "成为看板娘", "NextMtn": "ActiveChat:成为看板娘"}, {"Text": "初次见面", "NextMtn": "ActiveChat:初次见面"}], "TextDuration": 5000}` |
| 闲聊菜单-闲聊-其他#99 | 闲聊菜单-闲聊-其他 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "Chat-Other", "Choices": [{"Text": "Chat-Special", "NextMtn": "ActiveChat:闲聊-特殊"}, {"Text": "Chat-Likes", "NextMtn": "ActiveChat:闲聊-喜欢的东西"}, {"Text": "Chat-Dislikes", "NextMtn": "ActiveChat:闲聊-讨厌的东西"}, {"Text": "Chat-Continent Crescent", "NextMtn": "ActiveChat:闲聊-对新月大陆的看法"}, {"Text": "Chat-Other Dolls", "NextMtn": "ActiveChat:闲聊-同伴印象"}, {"Text": "Chat-Past", "NextMtn": "ActiveChat:闲聊-过去的自己"}, {"Text": "Oath-Chat", "NextMtn": "ActiveChat:闲聊-誓约"}, {"Text": "Greeting-Oath", "NextMtn": "ActiveChat:问候-誓约"}, {"Text": "Affinity Stage Increase", "NextMtn": "ActiveChat:好感度提升"}, {"Text": "Oath", "NextMtn": "ActiveChat:誓约"}, {"Text": "Chat-Depressed", "NextMtn": "ActiveChat:闲聊-不开心"}, {"Text": "Greeting-Depressed", "NextMtn": "ActiveChat:问候-不开心"}, {"Text": "Secretary", "NextMtn": "ActiveChat:成为看板娘"}, {"Text": "Firstmeeting", "NextMtn": "ActiveChat:初次见面"}], "TextDuration": 5000, "Language": "en"}` |
| 闲聊菜单-问候-上午#99 | 闲聊菜单-问候-上午 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "问候-上午", "Choices": [{"Text": "问候-雨天上午-初识", "NextMtn": "ActiveChat:问候-雨天上午-初识"}, {"Text": "问候-雨天上午-守护", "NextMtn": "ActiveChat:问候-雨天上午-守护"}, {"Text": "问候-晴天上午-初识", "NextMtn": "ActiveChat:问候-晴天上午-初识"}, {"Text": "问候-晴天上午-亲密", "NextMtn": "ActiveChat:问候-晴天上午-亲密"}, {"Text": "问候-晴天上午-誓约", "NextMtn": "ActiveChat:问候-晴天上午-誓约"}], "TextDuration": 5000}` |
| 闲聊菜单-问候-上午#99 | 闲聊菜单-问候-上午 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "Greet-Morning", "Choices": [{"Text": "Greeting-Rainy Morning-Neutral", "NextMtn": "ActiveChat:问候-雨天上午-初识"}, {"Text": "Greeting-Rainy Morning-Bestie", "NextMtn": "ActiveChat:问候-雨天上午-守护"}, {"Text": "Greeting-Morning-Neutral", "NextMtn": "ActiveChat:问候-晴天上午-初识"}, {"Text": "Greeting-Morning-Friend", "NextMtn": "ActiveChat:问候-晴天上午-亲密"}, {"Text": "Greeting-Morning-Oath", "NextMtn": "ActiveChat:问候-晴天上午-誓约"}], "TextDuration": 5000, "Language": "en"}` |
| 闲聊菜单-问候-下午#99 | 闲聊菜单-问候-下午 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "问候-下午", "Choices": [{"Text": "问候-雨天下午-初识", "NextMtn": "ActiveChat:问候-雨天下午-初识"}, {"Text": "问候-雨天下午-守护", "NextMtn": "ActiveChat:问候-雨天下午-守护"}, {"Text": "问候-晴天下午-初识", "NextMtn": "ActiveChat:问候-晴天下午-初识"}, {"Text": "问候-晴天下午-亲密", "NextMtn": "ActiveChat:问候-晴天下午-亲密"}, {"Text": "问候-晴天下午-誓约", "NextMtn": "ActiveChat:问候-晴天下午-誓约"}], "TextDuration": 5000}` |
| 闲聊菜单-问候-下午#99 | 闲聊菜单-问候-下午 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "Greet-Noon", "Choices": [{"Text": "Greeting-Rainy Afternoon-Neutral", "NextMtn": "ActiveChat:问候-雨天下午-初识"}, {"Text": "Greeting-Rainy Afternoon-Bestie", "NextMtn": "ActiveChat:问候-雨天下午-守护"}, {"Text": "Greeting-Afternoon-Neutral", "NextMtn": "ActiveChat:问候-晴天下午-初识"}, {"Text": "Greeting-Afternoon-Friend", "NextMtn": "ActiveChat:问候-晴天下午-亲密"}, {"Text": "Greeting-Afternoon-Oath", "NextMtn": "ActiveChat:问候-晴天下午-誓约"}], "TextDuration": 5000, "Language": "en"}` |
| 闲聊菜单-问候-晚上#99 | 闲聊菜单-问候-晚上 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "问候-晚上", "Choices": [{"Text": "问候-雨天晚上-初识", "NextMtn": "ActiveChat:问候-雨天晚上-初识"}, {"Text": "问候-雨天晚上-守护", "NextMtn": "ActiveChat:问候-雨天晚上-守护"}, {"Text": "问候-晴天晚上-初识", "NextMtn": "ActiveChat:问候-晴天晚上-初识"}, {"Text": "问候-晴天晚上-亲密", "NextMtn": "ActiveChat:问候-晴天晚上-亲密"}, {"Text": "问候-晴天晚上-誓约", "NextMtn": "ActiveChat:问候-晴天晚上-誓约"}], "TextDuration": 5000}` |
| 闲聊菜单-问候-晚上#99 | 闲聊菜单-问候-晚上 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "Greet-Night", "Choices": [{"Text": "Greeting-Rainy Evening-Neutral", "NextMtn": "ActiveChat:问候-雨天晚上-初识"}, {"Text": "Greeting-Rainy Evening-Bestie", "NextMtn": "ActiveChat:问候-雨天晚上-守护"}, {"Text": "Greeting-Evening-Neutral", "NextMtn": "ActiveChat:问候-晴天晚上-初识"}, {"Text": "Greeting-Evening-Friend", "NextMtn": "ActiveChat:问候-晴天晚上-亲密"}, {"Text": "Greeting-Evening-Oath", "NextMtn": "ActiveChat:问候-晴天晚上-誓约"}], "TextDuration": 5000, "Language": "en"}` |
| 闲聊菜单-问候-深夜#99 | 闲聊菜单-问候-深夜 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "问候-深夜", "Choices": [{"Text": "问候-雨天深夜-初识", "NextMtn": "ActiveChat:问候-雨天深夜-初识"}, {"Text": "问候-雨天深夜-守护", "NextMtn": "ActiveChat:问候-雨天深夜-守护"}, {"Text": "问候-晴天深夜-初识", "NextMtn": "ActiveChat:问候-晴天深夜-初识"}, {"Text": "问候-晴天深夜-亲密", "NextMtn": "ActiveChat:问候-晴天深夜-亲密"}, {"Text": "问候-晴天深夜-誓约", "NextMtn": "ActiveChat:问候-晴天深夜-誓约"}], "TextDuration": 5000}` |
| 闲聊菜单-问候-深夜#99 | 闲聊菜单-问候-深夜 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "Greet-Midnight", "Choices": [{"Text": "Greeting-Rainy Midnight-Neutral", "NextMtn": "ActiveChat:问候-雨天深夜-初识"}, {"Text": "Greeting-Rainy Midnight-Bestie", "NextMtn": "ActiveChat:问候-雨天深夜-守护"}, {"Text": "Greeting-Midnight-Neutral", "NextMtn": "ActiveChat:问候-晴天深夜-初识"}, {"Text": "Greeting-Midnight-Friend", "NextMtn": "ActiveChat:问候-晴天深夜-亲密"}, {"Text": "Greeting-Midnight-Oath", "NextMtn": "ActiveChat:问候-晴天深夜-誓约"}], "TextDuration": 5000, "Language": "en"}` |
| 闲聊菜单-问候-周末#99 | 闲聊菜单-问候-周末 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "问候-周末", "Choices": [{"Text": "问候-周末晴天-初识", "NextMtn": "ActiveChat:问候-周末晴天-初识"}, {"Text": "问候-周末晴天-亲密", "NextMtn": "ActiveChat:问候-周末晴天-亲密"}, {"Text": "问候-周末晴天-誓约", "NextMtn": "ActiveChat:问候-周末晴天-誓约"}, {"Text": "问候-周末雨天-初识", "NextMtn": "ActiveChat:问候-周末雨天-初识"}, {"Text": "问候-周末雨天-守护", "NextMtn": "ActiveChat:问候-周末雨天-守护"}], "TextDuration": 5000}` |
| 闲聊菜单-问候-周末#99 | 闲聊菜单-问候-周末 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "Greet-Weekend", "Choices": [{"Text": "Greeting-Weekend-Neutral", "NextMtn": "ActiveChat:问候-周末晴天-初识"}, {"Text": "Greeting-Weekend-Friend", "NextMtn": "ActiveChat:问候-周末晴天-亲密"}, {"Text": "Greeting-Weekend-Oath", "NextMtn": "ActiveChat:问候-周末晴天-誓约"}, {"Text": "Greeting-Rainy Weekend-Neutral", "NextMtn": "ActiveChat:问候-周末雨天-初识"}, {"Text": "Greeting-Rainy Weekend-Bestie", "NextMtn": "ActiveChat:问候-周末雨天-守护"}], "TextDuration": 5000, "Language": "en"}` |
| 闲聊菜单-问候-节日#99 | 闲聊菜单-问候-节日 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "问候-节日", "Choices": [{"Text": "问候-情人节", "NextMtn": "ActiveChat:问候-情人节"}, {"Text": "问候-圣诞", "NextMtn": "ActiveChat:问候-圣诞"}, {"Text": "问候-七夕", "NextMtn": "ActiveChat:问候-七夕"}, {"Text": "问候-生日", "NextMtn": "ActiveChat:问候-生日"}, {"Text": "问候-春节", "NextMtn": "ActiveChat:问候-春节"}, {"Text": "问候-结婚纪念日", "NextMtn": "ActiveChat:问候-结婚纪念日"}, {"Text": "问候-玩家生日", "NextMtn": "ActiveChat:问候-玩家生日"}], "TextDuration": 5000}` |
| 闲聊菜单-问候-节日#99 | 闲聊菜单-问候-节日 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "Greet-Festival", "Choices": [{"Text": "Festival-Valentine's Day", "NextMtn": "ActiveChat:问候-情人节"}, {"Text": "Festival-Christmas", "NextMtn": "ActiveChat:问候-圣诞"}, {"Text": "Festival-Tanabata", "NextMtn": "ActiveChat:问候-七夕"}, {"Text": "Festival-Birthday", "NextMtn": "ActiveChat:问候-生日"}, {"Text": "Festival-Spring Festival", "NextMtn": "ActiveChat:问候-春节"}, {"Text": "Oath-Festival", "NextMtn": "ActiveChat:问候-结婚纪念日"}, {"Text": "Festival-Evoker's Birthday", "NextMtn": "ActiveChat:问候-玩家生日"}], "TextDuration": 5000, "Language": "en"}` |
| 闲聊菜单-私语#99 | 闲聊菜单-私语 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "私语", "TextDuration": 5000}` |
| 闲聊菜单-私语#99 | 闲聊菜单-私语 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "Whisper", "TextDuration": 5000, "Language": "en"}` |
| 触摸菜单#99 | 触摸菜单 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "触摸动作", "Choices": [{"Text": "头部", "NextMtn": "触摸菜单-头部#99"}, {"Text": "手部", "NextMtn": "触摸菜单-手部#99"}, {"Text": "胸部", "NextMtn": "触摸菜单-胸部#99"}, {"Text": "腿部", "NextMtn": "触摸菜单-腿部#99"}, {"Text": "节日", "NextMtn": "触摸菜单-节日#99"}, {"Text": "其他", "NextMtn": "触摸菜单-其他#99"}], "TextDuration": 5000}` |
| 触摸菜单#99 | 触摸菜单 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "Touch Motion", "Choices": [{"Text": "Head", "NextMtn": "触摸菜单-头部#99"}, {"Text": "Hand", "NextMtn": "触摸菜单-手部#99"}, {"Text": "Bra", "NextMtn": "触摸菜单-胸部#99"}, {"Text": "Hip", "NextMtn": "触摸菜单-腿部#99"}, {"Text": "Festival", "NextMtn": "触摸菜单-节日#99"}, {"Text": "Other", "NextMtn": "触摸菜单-其他#99"}], "TextDuration": 5000, "Language": "en"}` |
| 触摸菜单-头部#99 | 触摸菜单-头部 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "头部", "Choices": [{"Text": "互动-头-初识", "NextMtn": "ActiveTouch:互动-头-初识"}, {"Text": "互动-头-同伴", "NextMtn": "ActiveTouch:互动-头-同伴"}, {"Text": "互动-头-亲密", "NextMtn": "ActiveTouch:互动-头-亲密"}, {"Text": "互动-头-守护", "NextMtn": "ActiveTouch:互动-头-守护"}, {"Text": "互动-头-誓约", "NextMtn": "ActiveTouch:互动-头-誓约"}], "TextDuration": 5000}` |
| 触摸菜单-头部#99 | 触摸菜单-头部 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "Head", "Choices": [{"Text": "Touch-Head-Neutral", "NextMtn": "ActiveTouch:互动-头-初识"}, {"Text": "Touch-Head-Associate", "NextMtn": "ActiveTouch:互动-头-同伴"}, {"Text": "Touch-Head-Friend", "NextMtn": "ActiveTouch:互动-头-亲密"}, {"Text": "Touch-Head-Bestie", "NextMtn": "ActiveTouch:互动-头-守护"}, {"Text": "Touch-Head-Oath", "NextMtn": "ActiveTouch:互动-头-誓约"}], "TextDuration": 5000, "Language": "en"}` |
| 触摸菜单-手部#99 | 触摸菜单-手部 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "手部", "Choices": [{"Text": "互动-手-初识", "NextMtn": "ActiveTouch:互动-手-初识"}, {"Text": "互动-手-同伴", "NextMtn": "ActiveTouch:互动-手-同伴"}, {"Text": "互动-手-亲密", "NextMtn": "ActiveTouch:互动-手-亲密"}, {"Text": "互动-手-守护", "NextMtn": "ActiveTouch:互动-手-守护"}, {"Text": "互动-手-誓约", "NextMtn": "ActiveTouch:互动-手-誓约"}], "TextDuration": 5000}` |
| 触摸菜单-手部#99 | 触摸菜单-手部 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "Hand", "Choices": [{"Text": "Touch-Hand-Neutral", "NextMtn": "ActiveTouch:互动-手-初识"}, {"Text": "Touch-Hand-Associate", "NextMtn": "ActiveTouch:互动-手-同伴"}, {"Text": "Touch-Hand-Friend", "NextMtn": "ActiveTouch:互动-手-亲密"}, {"Text": "Touch-Hand-Bestie", "NextMtn": "ActiveTouch:互动-手-守护"}, {"Text": "Touch-Hand-Oath", "NextMtn": "ActiveTouch:互动-手-誓约"}], "TextDuration": 5000, "Language": "en"}` |
| 触摸菜单-胸部#99 | 触摸菜单-胸部 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "胸部", "Choices": [{"Text": "互动-身体-初识", "NextMtn": "ActiveTouch:互动-身体-初识"}, {"Text": "互动-身体-亲密", "NextMtn": "ActiveTouch:互动-身体-亲密"}, {"Text": "互动-身体-守护", "NextMtn": "ActiveTouch:互动-身体-守护"}, {"Text": "互动-身体-誓约", "NextMtn": "ActiveTouch:互动-身体-誓约"}], "TextDuration": 5000}` |
| 触摸菜单-胸部#99 | 触摸菜单-胸部 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "Bra", "Choices": [{"Text": "Touch-Body-Neutral", "NextMtn": "ActiveTouch:互动-身体-初识"}, {"Text": "Touch-Body-Friend", "NextMtn": "ActiveTouch:互动-身体-亲密"}, {"Text": "Touch-Body-Bestie", "NextMtn": "ActiveTouch:互动-身体-守护"}, {"Text": "Touch-Body-Oath", "NextMtn": "ActiveTouch:互动-身体-誓约"}], "TextDuration": 5000, "Language": "en"}` |
| 触摸菜单-腿部#99 | 触摸菜单-腿部 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "腿部", "Choices": [{"Text": "互动-特殊", "NextMtn": "ActiveTouch:互动-特殊"}, {"Text": "互动-腿-守护", "NextMtn": "ActiveTouch:互动-腿-守护"}, {"Text": "互动-腿-誓约", "NextMtn": "ActiveTouch:互动-腿-誓约"}], "TextDuration": 5000}` |
| 触摸菜单-腿部#99 | 触摸菜单-腿部 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "Hip", "Choices": [{"Text": "Touch-Depressed", "NextMtn": "ActiveTouch:互动-特殊"}, {"Text": "Touch-Leg-Bestie", "NextMtn": "ActiveTouch:互动-腿-守护"}, {"Text": "Touch-Leg-Oath", "NextMtn": "ActiveTouch:互动-腿-誓约"}], "TextDuration": 5000, "Language": "en"}` |
| 触摸菜单-节日#99 | 触摸菜单-节日 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "节日", "Choices": [{"Text": "互动-情人节", "NextMtn": "ActiveTouch:互动-情人节"}, {"Text": "互动-七夕", "NextMtn": "ActiveTouch:互动-七夕"}, {"Text": "互动-春节", "NextMtn": "ActiveTouch:互动-春节"}, {"Text": "互动-圣诞", "NextMtn": "ActiveTouch:互动-圣诞"}, {"Text": "互动-生日", "NextMtn": "ActiveTouch:互动-生日"}], "TextDuration": 5000}` |
| 触摸菜单-节日#99 | 触摸菜单-节日 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "Festival", "Choices": [{"Text": "Touch-Valentine's Day", "NextMtn": "ActiveTouch:互动-情人节"}, {"Text": "Touch-Tanabata", "NextMtn": "ActiveTouch:互动-七夕"}, {"Text": "Touch-Spring Festival", "NextMtn": "ActiveTouch:互动-春节"}, {"Text": "Touch-Christmas", "NextMtn": "ActiveTouch:互动-圣诞"}, {"Text": "Touch-Birthday", "NextMtn": "ActiveTouch:互动-生日"}], "TextDuration": 5000, "Language": "en"}` |
| 触摸菜单-其他#99 | 触摸菜单-其他 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "其他", "Choices": [{"Text": "互动-一般的反馈1", "NextMtn": "ActiveTouch:互动-一般的反馈1"}, {"Text": "互动-一般的反馈2", "NextMtn": "ActiveTouch:互动-一般的反馈2"}, {"Text": "互动-较好的反馈1", "NextMtn": "ActiveTouch:互动-较好的反馈1"}, {"Text": "互动-较好的反馈2", "NextMtn": "ActiveTouch:互动-较好的反馈2"}, {"Text": "互动-很好的反馈1", "NextMtn": "ActiveTouch:互动-很好的反馈1"}, {"Text": "互动-很好的反馈2", "NextMtn": "ActiveTouch:互动-很好的反馈2"}, {"Text": "互动-厌恶的反馈", "NextMtn": "ActiveTouch:互动-厌恶的反馈"}, {"Text": "互动-不耐烦的反馈1", "NextMtn": "ActiveTouch:互动-不耐烦的反馈1"}, {"Text": "互动-不耐烦的反馈2", "NextMtn": "ActiveTouch:互动-不耐烦的反馈2"}, {"Text": "互动-誓约", "NextMtn": "ActiveTouch:互动-誓约"}, {"Text": "互动-誓约后的反馈", "NextMtn": "ActiveTouch:互动-誓约后的反馈"}], "TextDuration": 5000}` |
| 触摸菜单-其他#99 | 触摸菜单-其他 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "Other", "Choices": [{"Text": "Touch-Neutral 1", "NextMtn": "ActiveTouch:互动-一般的反馈1"}, {"Text": "Touch-Neutral 2", "NextMtn": "ActiveTouch:互动-一般的反馈2"}, {"Text": "Touch-Like 1", "NextMtn": "ActiveTouch:互动-较好的反馈1"}, {"Text": "Touch-Like 2", "NextMtn": "ActiveTouch:互动-较好的反馈2"}, {"Text": "Touch-Love 1", "NextMtn": "ActiveTouch:互动-很好的反馈1"}, {"Text": "Touch-Love 2", "NextMtn": "ActiveTouch:互动-很好的反馈2"}, {"Text": "Touch-Hate", "NextMtn": "ActiveTouch:互动-厌恶的反馈"}, {"Text": "Touch-Annoyed 1", "NextMtn": "ActiveTouch:互动-不耐烦的反馈1"}, {"Text": "Touch-Annoyed 2", "NextMtn": "ActiveTouch:互动-不耐烦的反馈2"}, {"Text": "Touch-Oath", "NextMtn": "ActiveTouch:互动-誓约"}, {"Text": "Oath-Touch", "NextMtn": "ActiveTouch:互动-誓约后的反馈"}], "TextDuration": 5000, "Language": "en"}` |
| 主动送礼菜单#99 | 主动送礼菜单 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "送礼动作", "Choices": [{"Text": "礼物", "NextMtn": "主动送礼菜单-礼物#99"}, {"Text": "食物", "NextMtn": "主动送礼菜单-食物#99"}], "TextDuration": 5000}` |
| 主动送礼菜单#99 | 主动送礼菜单 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "Gift Motion", "Choices": [{"Text": "Gift", "NextMtn": "主动送礼菜单-礼物#99"}, {"Text": "Food", "NextMtn": "主动送礼菜单-食物#99"}], "TextDuration": 5000, "Language": "en"}` |
| 主动送礼菜单-礼物#99 | 主动送礼菜单-礼物 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "礼物", "Choices": [{"Text": "礼物-喜欢", "NextMtn": "ActiveGift:礼物-喜欢"}, {"Text": "礼物-誓约", "NextMtn": "ActiveGift:礼物-誓约"}, {"Text": "礼物-情人节", "NextMtn": "ActiveGift:礼物-情人节"}, {"Text": "礼物-七夕", "NextMtn": "ActiveGift:礼物-七夕"}, {"Text": "礼物-春节", "NextMtn": "ActiveGift:礼物-春节"}, {"Text": "礼物-圣诞", "NextMtn": "ActiveGift:礼物-圣诞"}, {"Text": "礼物-生日", "NextMtn": "ActiveGift:礼物-生日"}, {"Text": "礼物-一般", "NextMtn": "ActiveGift:礼物-一般"}, {"Text": "礼物-讨厌", "NextMtn": "ActiveGift:礼物-讨厌"}], "TextDuration": 5000}` |
| 主动送礼菜单-礼物#99 | 主动送礼菜单-礼物 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "Gift", "Choices": [{"Text": "Gift-Like", "NextMtn": "ActiveGift:礼物-喜欢"}, {"Text": "Gift-Oath", "NextMtn": "ActiveGift:礼物-誓约"}, {"Text": "Gift-Valentine's Day", "NextMtn": "ActiveGift:礼物-情人节"}, {"Text": "Gift-Tanabata", "NextMtn": "ActiveGift:礼物-七夕"}, {"Text": "Gift-Spring Festival", "NextMtn": "ActiveGift:礼物-春节"}, {"Text": "Gift-Christmas", "NextMtn": "ActiveGift:礼物-圣诞"}, {"Text": "Gift-Birthday", "NextMtn": "ActiveGift:礼物-生日"}, {"Text": "Gift-Neutral", "NextMtn": "ActiveGift:礼物-一般"}, {"Text": "Gift-Dislike", "NextMtn": "ActiveGift:礼物-讨厌"}], "TextDuration": 5000, "Language": "en"}` |
| 主动送礼菜单-食物#99 | 主动送礼菜单-食物 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "食物", "Choices": [{"Text": "食物-喜欢1", "NextMtn": "ActiveGift:食物-喜欢1"}, {"Text": "食物-喜欢2", "NextMtn": "ActiveGift:食物-喜欢2"}, {"Text": "食物-讨厌1", "NextMtn": "ActiveGift:食物-讨厌1"}, {"Text": "食物-讨厌2", "NextMtn": "ActiveGift:食物-讨厌2"}, {"Text": "食物-一般1", "NextMtn": "ActiveGift:食物-一般1"}, {"Text": "食物-一般2", "NextMtn": "ActiveGift:食物-一般2"}, {"Text": "食物-一般3", "NextMtn": "ActiveGift:食物-一般3"}, {"Text": "食物-特殊1", "NextMtn": "ActiveGift:食物-特殊1"}, {"Text": "食物-特殊2", "NextMtn": "ActiveGift:食物-特殊2"}], "TextDuration": 5000}` |
| 主动送礼菜单-食物#99 | 主动送礼菜单-食物 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "Food", "Choices": [{"Text": "Food-Like 1", "NextMtn": "ActiveGift:食物-喜欢1"}, {"Text": "Food-Like 2", "NextMtn": "ActiveGift:食物-喜欢2"}, {"Text": "Food-Dislike 1", "NextMtn": "ActiveGift:食物-讨厌1"}, {"Text": "Food-Dislike 2", "NextMtn": "ActiveGift:食物-讨厌2"}, {"Text": "Food-Neutral 1", "NextMtn": "ActiveGift:食物-一般1"}, {"Text": "Food-Neutral 2", "NextMtn": "ActiveGift:食物-一般2"}, {"Text": "Food-Neutral 3", "NextMtn": "ActiveGift:食物-一般3"}, {"Text": "Food-Special 1", "NextMtn": "ActiveGift:食物-特殊1"}, {"Text": "Food-Special 2", "NextMtn": "ActiveGift:食物-特殊2"}], "TextDuration": 5000, "Language": "en"}` |
| Pose菜单#99 | Pose菜单 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "Pose动作", "Choices": [{"Text": "Angry_loop", "NextMtn": "Pose:Angry_loop"}, {"Text": "Joyful_loop", "NextMtn": "Pose:Joyful_loop"}, {"Text": "Sad_loop", "NextMtn": "Pose:Sad_loop"}, {"Text": "Serious_loop", "NextMtn": "Pose:Serious_loop"}, {"Text": "Terrified_loop", "NextMtn": "Pose:Terrified_loop"}, {"Text": "Vexedly_loop", "NextMtn": "Pose:Vexedly_loop"}, {"Text": "Wordless_loop", "NextMtn": "Pose:Wordless_loop"}], "TextDuration": 5000}` |
| Pose菜单#99 | Pose菜单 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "Gift Motion", "Choices": [{"Text": "Angry_loop", "NextMtn": "Pose:Angry_loop"}, {"Text": "Joyful_loop", "NextMtn": "Pose:Joyful_loop"}, {"Text": "Sad_loop", "NextMtn": "Pose:Sad_loop"}, {"Text": "Serious_loop", "NextMtn": "Pose:Serious_loop"}, {"Text": "Terrified_loop", "NextMtn": "Pose:Terrified_loop"}, {"Text": "Vexedly_loop", "NextMtn": "Pose:Vexedly_loop"}, {"Text": "Wordless_loop", "NextMtn": "Pose:Wordless_loop"}], "TextDuration": 5000, "Language": "en"}` |
| 闲聊开关#99 | 开 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "闲聊开关: 开", "VarFloats": [{"Name": "OpenChat", "Type": 1, "Code": "not_equal 1"}, {"Name": "OpenChat", "Type": 2, "Code": "assign 1"}]}` |
| 闲聊开关#99 | 关 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "闲聊开关: 关", "VarFloats": [{"Name": "OpenChat", "Type": 1, "Code": "not_equal 0"}, {"Name": "OpenChat", "Type": 2, "Code": "assign 0"}]}` |
| 闲聊开关#99 | 开 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "Chat Switch: ON", "Language": "en", "VarFloats": [{"Name": "OpenChat", "Type": 1, "Code": "not_equal 1"}, {"Name": "OpenChat", "Type": 2, "Code": "assign 1"}]}` |
| 闲聊开关#99 | 关 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "Chat Switch: OFF", "Language": "en", "VarFloats": [{"Name": "OpenChat", "Type": 1, "Code": "not_equal 0"}, {"Name": "OpenChat", "Type": 2, "Code": "assign 0"}]}` |
| 鼠标跟踪#99 | 开 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "鼠标跟踪: 开", "Command": "mouse_tracking enable", "VarFloats": [{"Name": "InMouseTracking", "Type": 1, "Code": "not_equal 1"}, {"Name": "InMouseTracking", "Type": 2, "Code": "assign 1"}]}` |
| 鼠标跟踪#99 | 关 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "鼠标跟踪: 关", "Command": "mouse_tracking disable", "VarFloats": [{"Name": "InMouseTracking", "Type": 1, "Code": "not_equal 0"}, {"Name": "InMouseTracking", "Type": 2, "Code": "assign 0"}]}` |
| 鼠标跟踪#99 | 开 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "Mouse Track: ON", "Command": "mouse_tracking enable", "Language": "en", "VarFloats": [{"Name": "InMouseTracking", "Type": 1, "Code": "not_equal 1"}, {"Name": "InMouseTracking", "Type": 2, "Code": "assign 1"}]}` |
| 鼠标跟踪#99 | 关 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "Mouse Track: OFF", "Command": "mouse_tracking disable", "Language": "en", "VarFloats": [{"Name": "InMouseTracking", "Type": 1, "Code": "not_equal 0"}, {"Name": "InMouseTracking", "Type": 2, "Code": "assign 0"}]}` |
| 待机动作#99 | 开 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "待机动作: 开", "Command": "start_mtn Idle;eye_blink disable", "PostCommand": "start_mtn StopIdle", "MotionDuration": 100, "VarFloats": [{"Name": "InIdle", "Type": 1, "Code": "not_equal 1"}, {"Name": "InIdle", "Type": 2, "Code": "assign 1"}]}` |
| 待机动作#99 | 关 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "待机动作: 关", "Command": "eye_blink enable", "PostCommand": "start_mtn StopIdle", "MotionDuration": 100, "VarFloats": [{"Name": "InIdle", "Type": 1, "Code": "not_equal 0"}, {"Name": "InIdle", "Type": 2, "Code": "assign 0"}]}` |
| 待机动作#99 | 开 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "Idle Motion: ON", "Command": "start_mtn Idle;eye_blink disable", "PostCommand": "start_mtn StopIdle", "MotionDuration": 100, "Language": "en", "VarFloats": [{"Name": "InIdle", "Type": 1, "Code": "not_equal 1"}, {"Name": "InIdle", "Type": 2, "Code": "assign 1"}]}` |
| 待机动作#99 | 关 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "Idle Motion: OFF", "Command": "eye_blink enable", "PostCommand": "start_mtn StopIdle", "MotionDuration": 100, "Language": "en", "VarFloats": [{"Name": "InIdle", "Type": 1, "Code": "not_equal 0"}, {"Name": "InIdle", "Type": 2, "Code": "assign 0"}]}` |
| Reload#99 | Reload | `{"Text": "重载完成", "PostCommand": "start_mtn InitNext", "Weight": 999, "VarFloats": [{"Name": "StartOver", "Type": 2, "Code": "assign 0"}]}` |
| Reload#99 | Reload | `{"Text": "Reload Complete", "PostCommand": "start_mtn InitNext", "Weight": 999, "Language": "en", "VarFloats": [{"Name": "StartOver", "Type": 2, "Code": "assign 0"}]}` |
| Debug菜单#99 | Debug菜单 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "Debug菜单", "Choices": [{"Text": "修复计时器", "NextMtn": "RepairTimer#99"}, {"Text": "停止计时器: {$vi_StopTimer}", "NextMtn": "StopTimer#99"}, {"Text": "Debug信息: {$vi_InDebug}", "NextMtn": "Debug信息#99"}, {"Text": "拖曳锁定: {$vi_DragLock}", "NextMtn": "拖曳锁定#99"}, {"Text": "好感度对照表", "NextMtn": "好感度对照表#99"}, {"Text": "增加好感度: {$intimacy}", "NextMtn": "增加好感度#99"}, {"Text": "降低好感度: {$intimacy}", "NextMtn": "降低好感度#99"}, {"Text": "满好感度", "NextMtn": "满好感度#99"}, {"Text": "空好感度", "NextMtn": "空好感度#99"}], "TextDuration": 5000}` |
| Debug菜单#99 | Debug菜单 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "Debug Menu", "Choices": [{"Text": "Repair Timer", "NextMtn": "RepairTimer#99"}, {"Text": "Stop Timer: {$vi_StopTimer}", "NextMtn": "StopTimer#99"}, {"Text": "Debug Info: {$vi_InDebug}", "NextMtn": "Debug信息#99"}, {"Text": "Drag Lock: {$vi_DragLock}", "NextMtn": "拖曳锁定#99"}, {"Text": "Intimacy Mapping Table", "NextMtn": "好感度对照表#99"}, {"Text": "Add Intimacy: {$intimacy}", "NextMtn": "增加好感度#99"}, {"Text": "Sub Intimacy: {$intimacy}", "NextMtn": "降低好感度#99"}, {"Text": "Max Intimacy", "NextMtn": "满好感度#99"}, {"Text": "Empty Intimacy", "NextMtn": "空好感度#99"}], "TextDuration": 5000, "Language": "en"}` |
| StopTimer#99 | StartTimer | `{"Text": "计时器已启动", "NextMtn": "RepairTimer#99", "Weight": 999, "VarFloats": [{"Name": "StopTimer", "Type": 1, "Code": "equal 1"}, {"Name": "StopTimer", "Type": 2, "Code": "assign 0"}]}` |
| StopTimer#99 | StopTimer | `{"Text": "计时器已停止", "Weight": 999, "VarFloats": [{"Name": "StopTimer", "Type": 1, "Code": "not_equal 1"}, {"Name": "StopTimer", "Type": 2, "Code": "assign 1"}]}` |
| Debug信息#99 | 开 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "Debug信息: 开", "VarFloats": [{"Name": "InDebug", "Type": 1, "Code": "not_equal 1"}, {"Name": "InDebug", "Type": 2, "Code": "assign 1"}]}` |
| Debug信息#99 | 关 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "Debug信息: 关", "VarFloats": [{"Name": "InDebug", "Type": 1, "Code": "not_equal 0"}, {"Name": "InDebug", "Type": 2, "Code": "assign 0"}]}` |
| Debug信息#99 | 开 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "Debug Info: ON", "Language": "en", "VarFloats": [{"Name": "InDebug", "Type": 1, "Code": "not_equal 1"}, {"Name": "InDebug", "Type": 2, "Code": "assign 1"}]}` |
| Debug信息#99 | 关 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "Debug Info: OFF", "Language": "en", "VarFloats": [{"Name": "InDebug", "Type": 1, "Code": "not_equal 0"}, {"Name": "InDebug", "Type": 2, "Code": "assign 0"}]}` |
| 拖曳锁定#99 | 开 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "拖曳锁定: 开", "VarFloats": [{"Name": "DragLock", "Type": 1, "Code": "not_equal 1"}, {"Name": "DragLock", "Type": 2, "Code": "assign 1"}]}` |
| 拖曳锁定#99 | 关 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "拖曳锁定: 关", "VarFloats": [{"Name": "DragLock", "Type": 1, "Code": "not_equal 0"}, {"Name": "DragLock", "Type": 2, "Code": "assign 0"}]}` |
| 拖曳锁定#99 | 开 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "Drag Lock: ON", "Language": "en", "VarFloats": [{"Name": "DragLock", "Type": 1, "Code": "not_equal 1"}, {"Name": "DragLock", "Type": 2, "Code": "assign 1"}]}` |
| 拖曳锁定#99 | 关 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "Drag Lock: OFF", "Language": "en", "VarFloats": [{"Name": "DragLock", "Type": 1, "Code": "not_equal 0"}, {"Name": "DragLock", "Type": 2, "Code": "assign 0"}]}` |
| 好感度对照表#99 | 好感度对照表 | `{"Text": ">=11 : >=1900{$br}>=21 : >=6350{$br}>=31 : >=14350{$br}>=35 : >=18870{$br}>=41 : >=27450{$br}>=50 : >=73850"}` |
| 增加好感度#99 | greater0 | `{"Intimacy": {"Min": 0, "Max": 1899, "Bonus": -100000}, "NextMtn": "区间控制#99:sel11"}` |
| 增加好感度#99 | greater11 | `{"Intimacy": {"Min": 1900, "Max": 6349, "Bonus": -100000}, "NextMtn": "区间控制#99:sel21"}` |
| 增加好感度#99 | greater21 | `{"Intimacy": {"Min": 6350, "Max": 14349, "Bonus": -100000}, "NextMtn": "区间控制#99:sel31"}` |
| 增加好感度#99 | greater31 | `{"Intimacy": {"Min": 14350, "Max": 18869, "Bonus": -100000}, "NextMtn": "区间控制#99:sel35"}` |
| 增加好感度#99 | greater35 | `{"Intimacy": {"Min": 18870, "Max": 27449, "Bonus": -100000}, "NextMtn": "区间控制#99:sel41"}` |
| 增加好感度#99 | greater41 | `{"Intimacy": {"Min": 27450, "Max": 73849, "Bonus": -100000}, "NextMtn": "区间控制#99:sel50"}` |
| 增加好感度#99 | greater50 | `{"Intimacy": {"Min": 73850, "Bonus": -100000}, "NextMtn": "满好感度#99"}` |
| 降低好感度#99 | greater0 | `{"Intimacy": {"Min": 1, "Max": 1900, "Bonus": -100000}, "NextMtn": "区间控制#99:sel0"}` |
| 降低好感度#99 | greater11 | `{"Intimacy": {"Min": 1901, "Max": 6350, "Bonus": -100000}, "NextMtn": "区间控制#99:sel11"}` |
| 降低好感度#99 | greater21 | `{"Intimacy": {"Min": 6351, "Max": 14350, "Bonus": -100000}, "NextMtn": "区间控制#99:sel21"}` |
| 降低好感度#99 | greater31 | `{"Intimacy": {"Min": 14351, "Max": 18870, "Bonus": -100000}, "NextMtn": "区间控制#99:sel31"}` |
| 降低好感度#99 | greater35 | `{"Intimacy": {"Min": 18871, "Max": 27450, "Bonus": -100000}, "NextMtn": "区间控制#99:sel35"}` |
| 降低好感度#99 | greater41 | `{"Intimacy": {"Min": 27451, "Max": 73850, "Bonus": -100000}, "NextMtn": "区间控制#99:sel41"}` |
| 降低好感度#99 | greater50 | `{"Intimacy": {"Min": 73849, "Bonus": -100000}, "NextMtn": "区间控制#99:sel50"}` |
| 区间控制#99 | sel0 | `{"Text": "当前好感度: {$intimacy}", "Intimacy": {}}` |
| 区间控制#99 | sel11 | `{"Text": "当前好感度: {$intimacy}", "Intimacy": {"Bonus": 1900}}` |
| 区间控制#99 | sel21 | `{"Text": "当前好感度: {$intimacy}", "Intimacy": {"Bonus": 6350}}` |
| 区间控制#99 | sel31 | `{"Text": "当前好感度: {$intimacy}", "Intimacy": {"Bonus": 14350}}` |
| 区间控制#99 | sel35 | `{"Text": "当前好感度: {$intimacy}", "Intimacy": {"Bonus": 18870}}` |
| 区间控制#99 | sel41 | `{"Text": "当前好感度: {$intimacy}", "Intimacy": {"Bonus": 27450}}` |
| 区间控制#99 | sel50 | `{"Text": "当前好感度: {$intimacy}", "Intimacy": {"Bonus": 73850}}` |
| 区间控制#99 | sel0 | `{"Text": "Current Intimacy: {$intimacy}", "Intimacy": {}, "Language": "en"}` |
| 区间控制#99 | sel11 | `{"Text": "Current Intimacy: {$intimacy}", "Intimacy": {"Bonus": 1900}, "Language": "en"}` |
| 区间控制#99 | sel21 | `{"Text": "Current Intimacy: {$intimacy}", "Intimacy": {"Bonus": 6350}, "Language": "en"}` |
| 区间控制#99 | sel31 | `{"Text": "Current Intimacy: {$intimacy}", "Intimacy": {"Bonus": 14350}, "Language": "en"}` |
| 区间控制#99 | sel35 | `{"Text": "Current Intimacy: {$intimacy}", "Intimacy": {"Bonus": 18870}, "Language": "en"}` |
| 区间控制#99 | sel41 | `{"Text": "Current Intimacy: {$intimacy}", "Intimacy": {"Bonus": 27450}, "Language": "en"}` |
| 区间控制#99 | sel50 | `{"Text": "Current Intimacy: {$intimacy}", "Intimacy": {"Bonus": 73850}, "Language": "en"}` |
| 满好感度#99 | 满好感度 | `{"Text": "当前好感度: {$intimacy}", "Intimacy": {"Bonus": 100000}, "Weight": 999}` |
| 满好感度#99 | 满好感度 | `{"Text": "Current Intimacy: {$intimacy}", "Intimacy": {"Bonus": 100000}, "Weight": 999, "Language": "en"}` |
| 空好感度#99 | 空好感度 | `{"Text": "当前好感度: {$intimacy}", "Intimacy": {"Bonus": -100000}, "Weight": 999}` |
| 空好感度#99 | 空好感度 | `{"Text": "Current Intimacy: {$intimacy}", "Intimacy": {"Bonus": -100000}, "Weight": 999, "Language": "en"}` |
| 日期菜单#99 | 日期菜单 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "日期菜单", "Choices": [{"Text": "全部: {$vi_DateFlag}", "NextMtn": "全部#99"}, {"Text": "周末: {$vi_InWeekend}", "NextMtn": "周末#99"}, {"Text": "玩家生日: {$vi_InPlayerBirthday}", "NextMtn": "玩家生日#99"}, {"Text": "情人节: {$vi_InValentine}", "NextMtn": "情人节#99"}, {"Text": "生日: {$vi_InBirthday}", "NextMtn": "生日#99"}, {"Text": "春节: {$vi_InSpringFestival}", "NextMtn": "春节#99"}, {"Text": "七夕: {$vi_InQixi}", "NextMtn": "七夕#99"}, {"Text": "圣诞: {$vi_InChristmas}", "NextMtn": "圣诞#99"}, {"Text": "结婚纪念日: {$vi_InFestival}", "NextMtn": "结婚纪念日#99"}], "TextDuration": 5000}` |
| 日期菜单#99 | 日期菜单 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "Date Menu", "Choices": [{"Text": "All: {$vi_DateFlag}", "NextMtn": "全部#99"}, {"Text": "Weekend: {$vi_InWeekend}", "NextMtn": "周末#99"}, {"Text": "Playe rBirthday: {$vi_InPlayerBirthday}", "NextMtn": "玩家生日#99"}, {"Text": "Valentine: {$vi_InValentine}", "NextMtn": "情人节#99"}, {"Text": "Birthday: {$vi_InBirthday}", "NextMtn": "生日#99"}, {"Text": "Spring Festival: {$vi_InSpringFestival}", "NextMtn": "春节#99"}, {"Text": "Tanabata: {$vi_InQixi}", "NextMtn": "七夕#99"}, {"Text": "Christmas: {$vi_InChristmas}", "NextMtn": "圣诞#99"}, {"Text": "Marriage Memorial: {$vi_InFestival}", "NextMtn": "结婚纪念日#99"}], "TextDuration": 5000, "Language": "en"}` |
| 全部#99 | 开 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "全部: 开", "VarFloats": [{"Name": "InWeekend", "Type": 2, "Code": "assign 1"}, {"Name": "InPlayerBirthday", "Type": 2, "Code": "assign 1"}, {"Name": "InValentine", "Type": 2, "Code": "assign 1"}, {"Name": "InBirthday", "Type": 2, "Code": "assign 1"}, {"Name": "InSpringFestival", "Type": 2, "Code": "assign 1"}, {"Name": "InQixi", "Type": 2, "Code": "assign 1"}, {"Name": "InChristmas", "Type": 2, "Code": "assign 1"}, {"Name": "InFestival", "Type": 2, "Code": "assign 1"}, {"Name": "DateFlag", "Type": 2, "Code": "assign 255"}, {"Name": "DateFlag", "Type": 1, "Code": "lower 255"}]}` |
| 全部#99 | 关 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "全部: 关", "VarFloats": [{"Name": "InWeekend", "Type": 2, "Code": "assign 0"}, {"Name": "InPlayerBirthday", "Type": 2, "Code": "assign 0"}, {"Name": "InValentine", "Type": 2, "Code": "assign 0"}, {"Name": "InBirthday", "Type": 2, "Code": "assign 0"}, {"Name": "InSpringFestival", "Type": 2, "Code": "assign 0"}, {"Name": "InQixi", "Type": 2, "Code": "assign 0"}, {"Name": "InChristmas", "Type": 2, "Code": "assign 0"}, {"Name": "InFestival", "Type": 2, "Code": "assign 0"}, {"Name": "DateFlag", "Type": 2, "Code": "assign 0"}, {"Name": "DateFlag", "Type": 1, "Code": "greater_equal 255"}]}` |
| 全部#99 | 开 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "All: ON", "Language": "en", "VarFloats": [{"Name": "InWeekend", "Type": 2, "Code": "assign 1"}, {"Name": "InPlayerBirthday", "Type": 2, "Code": "assign 1"}, {"Name": "InValentine", "Type": 2, "Code": "assign 1"}, {"Name": "InBirthday", "Type": 2, "Code": "assign 1"}, {"Name": "InSpringFestival", "Type": 2, "Code": "assign 1"}, {"Name": "InQixi", "Type": 2, "Code": "assign 1"}, {"Name": "InChristmas", "Type": 2, "Code": "assign 1"}, {"Name": "InFestival", "Type": 2, "Code": "assign 1"}, {"Name": "DateFlag", "Type": 2, "Code": "assign 255"}, {"Name": "DateFlag", "Type": 1, "Code": "lower 255"}]}` |
| 全部#99 | 关 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "All: OFF", "Language": "en", "VarFloats": [{"Name": "InWeekend", "Type": 2, "Code": "assign 0"}, {"Name": "InPlayerBirthday", "Type": 2, "Code": "assign 0"}, {"Name": "InValentine", "Type": 2, "Code": "assign 0"}, {"Name": "InBirthday", "Type": 2, "Code": "assign 0"}, {"Name": "InSpringFestival", "Type": 2, "Code": "assign 0"}, {"Name": "InQixi", "Type": 2, "Code": "assign 0"}, {"Name": "InChristmas", "Type": 2, "Code": "assign 0"}, {"Name": "InFestival", "Type": 2, "Code": "assign 0"}, {"Name": "DateFlag", "Type": 2, "Code": "assign 0"}, {"Name": "DateFlag", "Type": 1, "Code": "greater_equal 255"}]}` |
| 周末#99 | 开 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "周末: 开", "VarFloats": [{"Name": "InWeekend", "Type": 1, "Code": "not_equal 1"}, {"Name": "InWeekend", "Type": 2, "Code": "assign 1"}, {"Name": "DateFlag", "Type": 2, "Code": "add 1"}]}` |
| 周末#99 | 关 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "周末: 关", "VarFloats": [{"Name": "InWeekend", "Type": 1, "Code": "not_equal 0"}, {"Name": "InWeekend", "Type": 2, "Code": "assign 0"}, {"Name": "DateFlag", "Type": 2, "Code": "subtract 1"}]}` |
| 周末#99 | 开 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "Weekend: ON", "Language": "en", "VarFloats": [{"Name": "InWeekend", "Type": 1, "Code": "not_equal 1"}, {"Name": "InWeekend", "Type": 2, "Code": "assign 1"}, {"Name": "DateFlag", "Type": 2, "Code": "add 1"}]}` |
| 周末#99 | 关 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "Weekend: OFF", "Language": "en", "VarFloats": [{"Name": "InWeekend", "Type": 1, "Code": "not_equal 0"}, {"Name": "InWeekend", "Type": 2, "Code": "assign 0"}, {"Name": "DateFlag", "Type": 2, "Code": "subtract 1"}]}` |
| 玩家生日#99 | 开 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "玩家生日: 开", "VarFloats": [{"Name": "InPlayerBirthday", "Type": 1, "Code": "not_equal 1"}, {"Name": "InPlayerBirthday", "Type": 2, "Code": "assign 1"}, {"Name": "DateFlag", "Type": 2, "Code": "add 2"}]}` |
| 玩家生日#99 | 关 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "玩家生日: 关", "VarFloats": [{"Name": "InPlayerBirthday", "Type": 1, "Code": "not_equal 0"}, {"Name": "InPlayerBirthday", "Type": 2, "Code": "assign 0"}, {"Name": "DateFlag", "Type": 2, "Code": "subtract 2"}]}` |
| 玩家生日#99 | 开 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "Playe rBirthday: ON", "Language": "en", "VarFloats": [{"Name": "InPlayerBirthday", "Type": 1, "Code": "not_equal 1"}, {"Name": "InPlayerBirthday", "Type": 2, "Code": "assign 1"}, {"Name": "DateFlag", "Type": 2, "Code": "add 2"}]}` |
| 玩家生日#99 | 关 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "Playe rBirthday: OFF", "Language": "en", "VarFloats": [{"Name": "InPlayerBirthday", "Type": 1, "Code": "not_equal 0"}, {"Name": "InPlayerBirthday", "Type": 2, "Code": "assign 0"}, {"Name": "DateFlag", "Type": 2, "Code": "subtract 2"}]}` |
| 情人节#99 | 开 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "情人节: 开", "VarFloats": [{"Name": "InValentine", "Type": 1, "Code": "not_equal 1"}, {"Name": "InValentine", "Type": 2, "Code": "assign 1"}, {"Name": "DateFlag", "Type": 2, "Code": "add 4"}]}` |
| 情人节#99 | 关 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "情人节: 关", "VarFloats": [{"Name": "InValentine", "Type": 1, "Code": "not_equal 0"}, {"Name": "InValentine", "Type": 2, "Code": "assign 0"}, {"Name": "DateFlag", "Type": 2, "Code": "subtract 4"}]}` |
| 情人节#99 | 开 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "Valentine: ON", "Language": "en", "VarFloats": [{"Name": "InValentine", "Type": 1, "Code": "not_equal 1"}, {"Name": "InValentine", "Type": 2, "Code": "assign 1"}, {"Name": "DateFlag", "Type": 2, "Code": "add 4"}]}` |
| 情人节#99 | 关 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "Valentine: OFF", "Language": "en", "VarFloats": [{"Name": "InValentine", "Type": 1, "Code": "not_equal 0"}, {"Name": "InValentine", "Type": 2, "Code": "assign 0"}, {"Name": "DateFlag", "Type": 2, "Code": "subtract 4"}]}` |
| 生日#99 | 开 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "生日: 开", "VarFloats": [{"Name": "InBirthday", "Type": 1, "Code": "not_equal 1"}, {"Name": "InBirthday", "Type": 2, "Code": "assign 1"}, {"Name": "DateFlag", "Type": 2, "Code": "add 8"}]}` |
| 生日#99 | 关 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "生日: 关", "VarFloats": [{"Name": "InBirthday", "Type": 1, "Code": "not_equal 0"}, {"Name": "InBirthday", "Type": 2, "Code": "assign 0"}, {"Name": "DateFlag", "Type": 2, "Code": "subtract 8"}]}` |
| 生日#99 | 开 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "Birthday: ON", "Language": "en", "VarFloats": [{"Name": "InBirthday", "Type": 1, "Code": "not_equal 1"}, {"Name": "InBirthday", "Type": 2, "Code": "assign 1"}, {"Name": "DateFlag", "Type": 2, "Code": "add 8"}]}` |
| 生日#99 | 关 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "Birthday: OFF", "Language": "en", "VarFloats": [{"Name": "InBirthday", "Type": 1, "Code": "not_equal 0"}, {"Name": "InBirthday", "Type": 2, "Code": "assign 0"}, {"Name": "DateFlag", "Type": 2, "Code": "subtract 8"}]}` |
| 春节#99 | 开 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "春节: 开", "VarFloats": [{"Name": "InSpringFestival", "Type": 1, "Code": "not_equal 1"}, {"Name": "InSpringFestival", "Type": 2, "Code": "assign 1"}, {"Name": "DateFlag", "Type": 2, "Code": "add 16"}]}` |
| 春节#99 | 关 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "春节: 关", "VarFloats": [{"Name": "InSpringFestival", "Type": 1, "Code": "not_equal 0"}, {"Name": "InSpringFestival", "Type": 2, "Code": "assign 0"}, {"Name": "DateFlag", "Type": 2, "Code": "subtract 16"}]}` |
| 春节#99 | 开 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "Spring Festival: ON", "Language": "en", "VarFloats": [{"Name": "InSpringFestival", "Type": 1, "Code": "not_equal 1"}, {"Name": "InSpringFestival", "Type": 2, "Code": "assign 1"}, {"Name": "DateFlag", "Type": 2, "Code": "add 16"}]}` |
| 春节#99 | 关 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "Spring Festival: OFF", "Language": "en", "VarFloats": [{"Name": "InSpringFestival", "Type": 1, "Code": "not_equal 0"}, {"Name": "InSpringFestival", "Type": 2, "Code": "assign 0"}, {"Name": "DateFlag", "Type": 2, "Code": "subtract 16"}]}` |
| 七夕#99 | 开 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "七夕: 开", "VarFloats": [{"Name": "InQixi", "Type": 1, "Code": "not_equal 1"}, {"Name": "InQixi", "Type": 2, "Code": "assign 1"}, {"Name": "DateFlag", "Type": 2, "Code": "add 32"}]}` |
| 七夕#99 | 关 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "七夕: 关", "VarFloats": [{"Name": "InQixi", "Type": 1, "Code": "not_equal 0"}, {"Name": "InQixi", "Type": 2, "Code": "assign 0"}, {"Name": "DateFlag", "Type": 2, "Code": "subtract 32"}]}` |
| 七夕#99 | 开 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "Tanabata: ON", "Language": "en", "VarFloats": [{"Name": "InQixi", "Type": 1, "Code": "not_equal 1"}, {"Name": "InQixi", "Type": 2, "Code": "assign 1"}, {"Name": "DateFlag", "Type": 2, "Code": "add 32"}]}` |
| 七夕#99 | 关 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "Tanabata: OFF", "Language": "en", "VarFloats": [{"Name": "InQixi", "Type": 1, "Code": "not_equal 0"}, {"Name": "InQixi", "Type": 2, "Code": "assign 0"}, {"Name": "DateFlag", "Type": 2, "Code": "subtract 32"}]}` |
| 圣诞#99 | 开 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "圣诞: 开", "VarFloats": [{"Name": "InChristmas", "Type": 1, "Code": "not_equal 1"}, {"Name": "InChristmas", "Type": 2, "Code": "assign 1"}, {"Name": "DateFlag", "Type": 2, "Code": "add 64"}]}` |
| 圣诞#99 | 关 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "圣诞: 关", "VarFloats": [{"Name": "InChristmas", "Type": 1, "Code": "not_equal 0"}, {"Name": "InChristmas", "Type": 2, "Code": "assign 0"}, {"Name": "DateFlag", "Type": 2, "Code": "subtract 64"}]}` |
| 圣诞#99 | 开 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "Christmas: ON", "Language": "en", "VarFloats": [{"Name": "InChristmas", "Type": 1, "Code": "not_equal 1"}, {"Name": "InChristmas", "Type": 2, "Code": "assign 1"}, {"Name": "DateFlag", "Type": 2, "Code": "add 64"}]}` |
| 圣诞#99 | 关 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "Christmas: OFF", "Language": "en", "VarFloats": [{"Name": "InChristmas", "Type": 1, "Code": "not_equal 0"}, {"Name": "InChristmas", "Type": 2, "Code": "assign 0"}, {"Name": "DateFlag", "Type": 2, "Code": "subtract 64"}]}` |
| 结婚纪念日#99 | 开 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "结婚纪念日: 开", "VarFloats": [{"Name": "InFestival", "Type": 1, "Code": "not_equal 1"}, {"Name": "InFestival", "Type": 2, "Code": "assign 1"}, {"Name": "DateFlag", "Type": 2, "Code": "add 128"}]}` |
| 结婚纪念日#99 | 关 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "结婚纪念日: 关", "VarFloats": [{"Name": "InFestival", "Type": 1, "Code": "not_equal 0"}, {"Name": "InFestival", "Type": 2, "Code": "assign 0"}, {"Name": "DateFlag", "Type": 2, "Code": "subtract 128"}]}` |
| 结婚纪念日#99 | 开 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "Marriage Memorial: ON", "Language": "en", "VarFloats": [{"Name": "InFestival", "Type": 1, "Code": "not_equal 1"}, {"Name": "InFestival", "Type": 2, "Code": "assign 1"}, {"Name": "DateFlag", "Type": 2, "Code": "add 128"}]}` |
| 结婚纪念日#99 | 关 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "Marriage Memorial: OFF", "Language": "en", "VarFloats": [{"Name": "InFestival", "Type": 1, "Code": "not_equal 0"}, {"Name": "InFestival", "Type": 2, "Code": "assign 0"}, {"Name": "DateFlag", "Type": 2, "Code": "subtract 128"}]}` |
| 环境菜单#99 | 环境菜单 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "环境菜单: {$vi_InENV}", "Choices": [{"Text": "停止播放", "NextMtn": "ENVPlayer#99:停止播放"}, {"Text": "自然", "NextMtn": "环境-自然#99"}, {"Text": "森林", "NextMtn": "环境-森林#99"}, {"Text": "其他", "NextMtn": "环境-其他#99"}], "TextDuration": 5000}` |
| 环境菜单#99 | 环境菜单 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "ENV Menu: {$vi_InENV}", "Choices": [{"Text": "Stop Play", "NextMtn": "ENVPlayer#99:停止播放"}, {"Text": "Nature", "NextMtn": "环境-自然#99"}, {"Text": "Forest", "NextMtn": "环境-森林#99"}, {"Text": "Other", "NextMtn": "环境-其他#99"}], "TextDuration": 5000, "Language": "en"}` |
| Idle#4 | Env_Nature_Rain_Near | `{"Sound": "Motions_Idle#4_0_Sound_0.ogg", "SoundChannel": 2, "SoundVolume": 0.5, "Command": "start_mtn RepairTimer#99", "MotionDuration": 135324, "VarFloats": [{"Name": "InENV", "Type": 1, "Code": "equal 1"}, {"Name": "ENVRepairTimer", "Type": 2, "Code": "assign 165.324"}]}` |
| Idle#4 | Env_Nature_Rain_Near02 | `{"Sound": "Motions_Idle#4_1_Sound_0.ogg", "SoundChannel": 2, "SoundVolume": 0.5, "Command": "start_mtn RepairTimer#99", "MotionDuration": 135324, "VarFloats": [{"Name": "InENV", "Type": 1, "Code": "equal 2"}, {"Name": "ENVRepairTimer", "Type": 2, "Code": "assign 165.324"}]}` |
| Idle#4 | Env_Nature_Rain_Thunder | `{"Sound": "Motions_Idle#4_2_Sound_0.ogg", "SoundChannel": 2, "SoundVolume": 0.5, "Command": "start_mtn RepairTimer#99", "MotionDuration": 92794, "VarFloats": [{"Name": "InENV", "Type": 1, "Code": "equal 3"}, {"Name": "ENVRepairTimer", "Type": 2, "Code": "assign 122.794"}]}` |
| Idle#4 | Env_Nature_Rain_Far | `{"Sound": "Motions_Idle#4_3_Sound_0.ogg", "SoundChannel": 2, "SoundVolume": 0.5, "Command": "start_mtn RepairTimer#99", "MotionDuration": 54130, "VarFloats": [{"Name": "InENV", "Type": 1, "Code": "equal 4"}, {"Name": "ENVRepairTimer", "Type": 2, "Code": "assign 84.13"}]}` |
| Idle#4 | 无声下雨 | `{"SoundChannel": 2, "SoundVolume": 0.5, "Command": "start_mtn RepairTimer#99", "MotionDuration": 300000, "VarFloats": [{"Name": "InENV", "Type": 1, "Code": "equal 5"}, {"Name": "ENVRepairTimer", "Type": 2, "Code": "assign 330"}]}` |
| Idle#4 | Env_Nature_WindBirds | `{"Sound": "Motions_Idle#4_5_Sound_0.ogg", "SoundChannel": 2, "SoundVolume": 0.5, "Command": "start_mtn RepairTimer#99", "MotionDuration": 21266, "VarFloats": [{"Name": "InENV", "Type": 1, "Code": "equal 6"}, {"Name": "ENVRepairTimer", "Type": 2, "Code": "assign 51.266"}]}` |
| Idle#4 | Env_Forest_River | `{"Sound": "Motions_Idle#4_6_Sound_0.ogg", "SoundChannel": 2, "SoundVolume": 0.5, "Command": "start_mtn RepairTimer#99", "MotionDuration": 60896, "VarFloats": [{"Name": "InENV", "Type": 1, "Code": "equal 7"}, {"Name": "ENVRepairTimer", "Type": 2, "Code": "assign 90.896"}]}` |
| Idle#4 | Env_ForestAmbience01 | `{"Sound": "Motions_Idle#4_7_Sound_0.ogg", "SoundChannel": 2, "SoundVolume": 0.5, "Command": "start_mtn RepairTimer#99", "MotionDuration": 18366, "VarFloats": [{"Name": "InENV", "Type": 1, "Code": "equal 8"}, {"Name": "ENVRepairTimer", "Type": 2, "Code": "assign 48.366"}]}` |
| Idle#4 | Env_Forest_Normal | `{"Sound": "Motions_Idle#4_8_Sound_0.ogg", "SoundChannel": 2, "SoundVolume": 0.5, "Command": "start_mtn RepairTimer#99", "MotionDuration": 61380, "VarFloats": [{"Name": "InENV", "Type": 1, "Code": "equal 9"}, {"Name": "ENVRepairTimer", "Type": 2, "Code": "assign 91.38"}]}` |
| Idle#4 | Env_NightHabour | `{"Sound": "Motions_Idle#4_9_Sound_0.ogg", "SoundChannel": 2, "SoundVolume": 0.5, "Command": "start_mtn RepairTimer#99", "MotionDuration": 43497, "VarFloats": [{"Name": "InENV", "Type": 1, "Code": "equal 10"}, {"Name": "ENVRepairTimer", "Type": 2, "Code": "assign 73.497"}]}` |
| Idle#4 | Env_HabourAmbience | `{"Sound": "Motions_Idle#4_10_Sound_0.ogg", "SoundChannel": 2, "SoundVolume": 0.5, "Command": "start_mtn RepairTimer#99", "MotionDuration": 32865, "VarFloats": [{"Name": "InENV", "Type": 1, "Code": "equal 11"}, {"Name": "ENVRepairTimer", "Type": 2, "Code": "assign 62.865"}]}` |
| ENVPlayer#99 | 停止播放 | `{"SoundChannel": 2, "Text": "停止播放", "Command": "stop_sound 2", "VarFloats": [{"Name": "InENV", "Type": 2, "Code": "assign 0"}, {"Name": "InRain", "Type": 2, "Code": "assign 0"}]}` |
| ENVPlayer#99 | Env_Nature_Rain_Near | `{"PostCommand": "start_mtn Idle#4", "VarFloats": [{"Name": "InENV", "Type": 2, "Code": "assign 1"}, {"Name": "InRain", "Type": 2, "Code": "assign 1"}]}` |
| ENVPlayer#99 | Env_Nature_Rain_Near02 | `{"PostCommand": "start_mtn Idle#4", "VarFloats": [{"Name": "InENV", "Type": 2, "Code": "assign 2"}, {"Name": "InRain", "Type": 2, "Code": "assign 1"}]}` |
| ENVPlayer#99 | Env_Nature_Rain_Thunder | `{"PostCommand": "start_mtn Idle#4", "VarFloats": [{"Name": "InENV", "Type": 2, "Code": "assign 3"}, {"Name": "InRain", "Type": 2, "Code": "assign 1"}]}` |
| ENVPlayer#99 | Env_Nature_Rain_Far | `{"PostCommand": "start_mtn Idle#4", "VarFloats": [{"Name": "InENV", "Type": 2, "Code": "assign 4"}, {"Name": "InRain", "Type": 2, "Code": "assign 1"}]}` |
| ENVPlayer#99 | 无声下雨 | `{"PostCommand": "start_mtn Idle#4", "VarFloats": [{"Name": "InENV", "Type": 2, "Code": "assign 5"}, {"Name": "InRain", "Type": 2, "Code": "assign 1"}]}` |
| ENVPlayer#99 | Env_Nature_WindBirds | `{"PostCommand": "start_mtn Idle#4", "VarFloats": [{"Name": "InENV", "Type": 2, "Code": "assign 6"}, {"Name": "InRain", "Type": 2, "Code": "assign 0"}]}` |
| ENVPlayer#99 | Env_Forest_River | `{"PostCommand": "start_mtn Idle#4", "VarFloats": [{"Name": "InENV", "Type": 2, "Code": "assign 7"}, {"Name": "InRain", "Type": 2, "Code": "assign 0"}]}` |
| ENVPlayer#99 | Env_ForestAmbience01 | `{"PostCommand": "start_mtn Idle#4", "VarFloats": [{"Name": "InENV", "Type": 2, "Code": "assign 8"}, {"Name": "InRain", "Type": 2, "Code": "assign 0"}]}` |
| ENVPlayer#99 | Env_Forest_Normal | `{"PostCommand": "start_mtn Idle#4", "VarFloats": [{"Name": "InENV", "Type": 2, "Code": "assign 9"}, {"Name": "InRain", "Type": 2, "Code": "assign 0"}]}` |
| ENVPlayer#99 | Env_NightHabour | `{"PostCommand": "start_mtn Idle#4", "VarFloats": [{"Name": "InENV", "Type": 2, "Code": "assign 10"}, {"Name": "InRain", "Type": 2, "Code": "assign 0"}]}` |
| ENVPlayer#99 | Env_HabourAmbience | `{"PostCommand": "start_mtn Idle#4", "VarFloats": [{"Name": "InENV", "Type": 2, "Code": "assign 11"}, {"Name": "InRain", "Type": 2, "Code": "assign 0"}]}` |
| ENVPlayer#99 | 停止播放 | `{"SoundChannel": 2, "Text": "Stop Play", "Command": "stop_sound 2", "Language": "en", "VarFloats": [{"Name": "InENV", "Type": 2, "Code": "assign 0"}, {"Name": "InRain", "Type": 2, "Code": "assign 0"}]}` |
| 环境-自然#99 | 环境-自然 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "自然", "Choices": [{"Text": "雨1", "NextMtn": "ENVPlayer#99:Env_Nature_Rain_Near"}, {"Text": "雨2", "NextMtn": "ENVPlayer#99:Env_Nature_Rain_Near02"}, {"Text": "雷雨", "NextMtn": "ENVPlayer#99:Env_Nature_Rain_Thunder"}, {"Text": "远雨", "NextMtn": "ENVPlayer#99:Env_Nature_Rain_Far"}, {"Text": "无声下雨", "NextMtn": "ENVPlayer#99:无声下雨"}, {"Text": "风声鸟啼", "NextMtn": "ENVPlayer#99:Env_Nature_WindBirds"}], "TextDuration": 5000}` |
| 环境-自然#99 | 环境-自然 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "Nature", "Choices": [{"Text": "Rain1", "NextMtn": "ENVPlayer#99:Env_Nature_Rain_Near"}, {"Text": "Rain2", "NextMtn": "ENVPlayer#99:Env_Nature_Rain_Near02"}, {"Text": "Rain Thunder", "NextMtn": "ENVPlayer#99:Env_Nature_Rain_Thunder"}, {"Text": "Rain Far", "NextMtn": "ENVPlayer#99:Env_Nature_Rain_Far"}, {"Text": "None Audio Rain", "NextMtn": "ENVPlayer#99:无声下雨"}, {"Text": "WindBirds", "NextMtn": "ENVPlayer#99:Env_Nature_WindBirds"}], "TextDuration": 5000, "Language": "en"}` |
| 环境-森林#99 | 环境-森林 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "森林", "Choices": [{"Text": "森林河流", "NextMtn": "ENVPlayer#99:Env_Forest_River"}, {"Text": "森林氛围", "NextMtn": "ENVPlayer#99:Env_ForestAmbience01"}, {"Text": "森林普通", "NextMtn": "ENVPlayer#99:Env_Forest_Normal"}], "TextDuration": 5000}` |
| 环境-森林#99 | 环境-森林 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "Forest", "Choices": [{"Text": "Forest_River", "NextMtn": "ENVPlayer#99:Env_Forest_River"}, {"Text": "ForestAmbience01", "NextMtn": "ENVPlayer#99:Env_ForestAmbience01"}, {"Text": "Forest_Normal", "NextMtn": "ENVPlayer#99:Env_Forest_Normal"}], "TextDuration": 5000, "Language": "en"}` |
| 环境-其他#99 | 环境-其他 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "其他", "Choices": [{"Text": "夜晚港口", "NextMtn": "ENVPlayer#99:Env_NightHabour"}, {"Text": "港口氛围", "NextMtn": "ENVPlayer#99:Env_HabourAmbience"}], "TextDuration": 5000}` |
| 环境-其他#99 | 环境-其他 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "Other", "Choices": [{"Text": "NightHabour", "NextMtn": "ENVPlayer#99:Env_NightHabour"}, {"Text": "HabourAmbience", "NextMtn": "ENVPlayer#99:Env_HabourAmbience"}], "TextDuration": 5000, "Language": "en"}` |
| BGM点播#99 | BGM点播 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "BGM点播: {$vi_InBGMPlayer}", "Choices": [{"Text": "停止播放", "NextMtn": "BGMPlayer#99:停止播放"}, {"Text": "皮肤", "NextMtn": "音乐-皮肤#99"}, {"Text": "EP", "NextMtn": "音乐-EP#99"}, {"Text": "私语", "NextMtn": "音乐-私语#99"}], "TextDuration": 5000}` |
| BGM点播#99 | BGM点播 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "BGM Player: {$vi_InBGMPlayer}", "Choices": [{"Text": "Stop Play", "NextMtn": "BGMPlayer#99:停止播放"}, {"Text": "Fashion", "NextMtn": "音乐-皮肤#99"}, {"Text": "EP", "NextMtn": "音乐-EP#99"}, {"Text": "Whisper", "NextMtn": "音乐-私语#99"}], "TextDuration": 5000, "Language": "en"}` |
| BGMPlayer#99 | 停止播放 | `{"SoundChannel": 1, "Text": "停止播放", "Command": "stop_sound 1", "VarFloats": [{"Name": "InBGMPlayer", "Type": 2, "Code": "assign 0"}]}` |
| BGMPlayer#99 | 停止播放 | `{"SoundChannel": 1, "Text": "Stop Play", "Command": "stop_sound 1", "Language": "en", "VarFloats": [{"Name": "InBGMPlayer", "Type": 2, "Code": "assign 0"}]}` |
| 音乐-皮肤#99 | 音乐-皮肤 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "皮肤", "TextDuration": 5000}` |
| 音乐-皮肤#99 | 音乐-皮肤 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "Fashion", "TextDuration": 5000, "Language": "en"}` |
| 音乐-EP#99 | 音乐-EP | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "EP", "TextDuration": 5000}` |
| 音乐-私语#99 | 音乐-私语 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "私语", "TextDuration": 5000}` |
| 音乐-私语#99 | 音乐-私语 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "Whisper", "TextDuration": 5000, "Language": "en"}` |
| 角色菜单#99 | 角色菜单 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "角色菜单", "Choices": [{"Text": "Vanilla", "NextMtn": "SelChar#99:selAria_Vanilla"}], "TextDuration": 5000}` |
| 角色菜单#99 | 角色菜单 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "Char Menu", "Choices": [{"Text": "Vanilla", "NextMtn": "SelChar#99:selAria_Vanilla"}], "TextDuration": 5000, "Language": "en"}` |
| SelChar#99 | selAria_Vanilla | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "PostCommand": "change_cos model0.json"}` |
| 纹理菜单#99 | 纹理菜单 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "纹理菜单: {$vi_TextureNum}", "Choices": [{"Text": "default", "NextMtn": "selTexture0#99"}], "TextDuration": 5000}` |
| 纹理菜单#99 | 纹理菜单 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "Text": "Texture Menu: {$vi_TextureNum}", "Choices": [{"Text": "default", "NextMtn": "selTexture0#99"}], "TextDuration": 5000, "Language": "en"}` |
| selTexture0#99 | selTexture0 | `{"Sound": "Motions_Tap_0_Sound_0.ogg", "SoundVolume": 0.5, "PostCommand": "replace_tex 0 Motions_selTexture0#99_0_PostCommand_0.png", "VarFloats": [{"Name": "TextureNum", "Type": 2, "Code": "assign 0"}]}` |
| FStartEnd | FStartEnd | `{"Command": "start_mtn DelayStartMtn#99", "VarFloats": [{"Name": "StartOver", "Type": 2, "Code": "assign 1"}]}` |
| FStartAfter2 | FStartAfter2_0 | `{"Command": "start_mtn FStartEnd"}` |
| Idle#98 | Update | `{"MotionDuration": 200, "NextMtn": "Update1#98", "VarFloats": [{"Name": "StopTimer", "Type": 1, "Code": "not_equal 1"}]}` |
| RepairTimer#99 | RepairTimer | `{"NextMtn": "Idle#98", "Weight": 999}` |
| Tick | AutoRepairTimer | `{"Command": "start_mtn RepairTimer#99"}` |

---

## 🎭 Model: `live2d_3348681028`
* **Windows Host Path**: `C:\users\h4rdc\Documents\Github\coding-agent\VRMs\packages_live2d_multi\live2d_3348681028.zip`
Total custom entries pruned: **10**

| Group | Entry Name | Custom Properties (Special Sauce) |
| :--- | :--- | :--- |
| 选择皮肤 | Entry 0 | `{"Text": "选择皮肤", "Choices": [{"Text": "Exceed Gear", "NextMtn": "Exceed Gear:Exceed Gear"}, {"Text": "BPL", "NextMtn": "BPL:BPL"}, {"Text": "正常版", "NextMtn": "正常版:正常版"}, {"Text": "里版", "NextMtn": "里版:里版"}]}` |
| 正常版 | 正常版 | `{"PostCommand": "replace_tex 0 Motions_正常版_0_PostCommand_0.png;replace_tex 1 Motions_正常版_0_PostCommand_0_0.png"}` |
| 里版 | 里版 | `{"PostCommand": "replace_tex 0 Motions_里版_0_PostCommand_0.png;replace_tex 1 Motions_里版_0_PostCommand_0_0.png"}` |
| Sound | Sound_1 | `{"Sound": "Motions_Sound_0_Sound_1.ogg"}` |
| Sound | Sound_2 | `{"Sound": "Motions_Sound_1_Sound_1.ogg"}` |
| Sound | Sound_3 | `{"Sound": "Motions_Sound_2_Sound_1.ogg"}` |
| Sound | Sound_4 | `{"Sound": "Motions_Sound_3_Sound_1.ogg"}` |
| Sound | Sound_5 | `{"Sound": "Motions_Sound_6_Sound_1.ogg"}` |
| Sound | Sound_6 | `{"Sound": "Motions_Sound_5_Sound_1.ogg"}` |
| Sound | Sound_7 | `{"Sound": "Motions_Sound_6_Sound_1.ogg"}` |

---

## 🎭 Model: `live2d_3548538714` (Senran Kagura Standby Characters)
* **Windows Host Path**: `C:\users\h4rdc\Documents\Github\coding-agent\VRMs\packages_live2d_multi\live2d_3548538714.zip`
Total custom entries pruned: **228**

### 💡 The Standby Costume-Swapping Engine
This item represents a massive compilation of **228 standby characters** packed into a single package. Rather than splitting the assets into 228 distinct Steam Workshop listings, the creator utilized a dynamic costume-switching paradigm.

*   **Key Discovery:** The primary model `3548538714.model3.json` (originally `model0.json`) functions as the system orchestrator, deploying a built-in UI menu to hot-swap between models.
*   **The Special Sauce:** Every menu interaction calls the custom `change_cos` command:
    `{"Command": "change_cos model1.json"}` through `{"Command": "change_cos model228.json"}`
*   **Execution Behavior:** When executed, the interpreter is expected to dynamically unload the current `.moc3` character, load the target submodel (`modelX.json`), and swap the WebGL textures in real-time, all while keeping the container canvas and user's session variables perfectly intact.

| Group | Entry Name | Custom Properties (Special Sauce) |
| :--- | :--- | :--- |
| Start | 0 | `{"Command": "change_cos model1.json"}` |
| Start | 1 | `{"Command": "change_cos model2.json"}` |
| Start | 2 | `{"Command": "change_cos model3.json"}` |
| Start | 3 | `{"Command": "change_cos model4.json"}` |
| Start | 4 | `{"Command": "change_cos model5.json"}` |
| Start | 5 | `{"Command": "change_cos model6.json"}` |
| Start | 6 | `{"Command": "change_cos model7.json"}` |
| Start | 7 | `{"Command": "change_cos model8.json"}` |
| Start | 8 | `{"Command": "change_cos model9.json"}` |
| Start | 9 | `{"Command": "change_cos model10.json"}` |
| Start | 10 | `{"Command": "change_cos model11.json"}` |
| Start | 11 | `{"Command": "change_cos model12.json"}` |
| Start | 12 | `{"Command": "change_cos model13.json"}` |
| Start | 13 | `{"Command": "change_cos model14.json"}` |
| Start | 14 | `{"Command": "change_cos model15.json"}` |
| Start | 15 | `{"Command": "change_cos model16.json"}` |
| Start | 16 | `{"Command": "change_cos model17.json"}` |
| Start | 17 | `{"Command": "change_cos model18.json"}` |
| Start | 18 | `{"Command": "change_cos model19.json"}` |
| Start | 19 | `{"Command": "change_cos model20.json"}` |
| Start | 20 | `{"Command": "change_cos model21.json"}` |
| Start | 21 | `{"Command": "change_cos model22.json"}` |
| Start | 22 | `{"Command": "change_cos model23.json"}` |
| Start | 23 | `{"Command": "change_cos model24.json"}` |
| Start | 24 | `{"Command": "change_cos model25.json"}` |
| Start | 25 | `{"Command": "change_cos model26.json"}` |
| Start | 26 | `{"Command": "change_cos model27.json"}` |
| Start | 27 | `{"Command": "change_cos model28.json"}` |
| Start | 28 | `{"Command": "change_cos model29.json"}` |
| Start | 29 | `{"Command": "change_cos model30.json"}` |
| Start | 30 | `{"Command": "change_cos model31.json"}` |
| Start | 31 | `{"Command": "change_cos model32.json"}` |
| Start | 32 | `{"Command": "change_cos model33.json"}` |
| Start | 33 | `{"Command": "change_cos model34.json"}` |
| Start | 34 | `{"Command": "change_cos model35.json"}` |
| Start | 35 | `{"Command": "change_cos model36.json"}` |
| Start | 36 | `{"Command": "change_cos model37.json"}` |
| Start | 37 | `{"Command": "change_cos model38.json"}` |
| Start | 38 | `{"Command": "change_cos model39.json"}` |
| Start | 39 | `{"Command": "change_cos model40.json"}` |
| Start | 40 | `{"Command": "change_cos model41.json"}` |
| Start | 41 | `{"Command": "change_cos model42.json"}` |
| Start | 42 | `{"Command": "change_cos model43.json"}` |
| Start | 43 | `{"Command": "change_cos model44.json"}` |
| Start | 44 | `{"Command": "change_cos model45.json"}` |
| Start | 45 | `{"Command": "change_cos model46.json"}` |
| Start | 46 | `{"Command": "change_cos model47.json"}` |
| Start | 47 | `{"Command": "change_cos model48.json"}` |
| Start | 48 | `{"Command": "change_cos model49.json"}` |
| Start | 49 | `{"Command": "change_cos model50.json"}` |
| Start | 50 | `{"Command": "change_cos model51.json"}` |
| Start | 51 | `{"Command": "change_cos model52.json"}` |
| Start | 52 | `{"Command": "change_cos model53.json"}` |
| Start | 53 | `{"Command": "change_cos model54.json"}` |
| Start | 54 | `{"Command": "change_cos model55.json"}` |
| Start | 55 | `{"Command": "change_cos model56.json"}` |
| Start | 56 | `{"Command": "change_cos model57.json"}` |
| Start | 57 | `{"Command": "change_cos model58.json"}` |
| Start | 58 | `{"Command": "change_cos model59.json"}` |
| Start | 59 | `{"Command": "change_cos model60.json"}` |
| Start | 60 | `{"Command": "change_cos model61.json"}` |
| Start | 61 | `{"Command": "change_cos model62.json"}` |
| Start | 62 | `{"Command": "change_cos model63.json"}` |
| Start | 63 | `{"Command": "change_cos model64.json"}` |
| Start | 64 | `{"Command": "change_cos model65.json"}` |
| Start | 65 | `{"Command": "change_cos model66.json"}` |
| Start | 66 | `{"Command": "change_cos model67.json"}` |
| Start | 67 | `{"Command": "change_cos model68.json"}` |
| Start | 68 | `{"Command": "change_cos model69.json"}` |
| Start | 69 | `{"Command": "change_cos model70.json"}` |
| Start | 70 | `{"Command": "change_cos model71.json"}` |
| Start | 71 | `{"Command": "change_cos model72.json"}` |
| Start | 72 | `{"Command": "change_cos model73.json"}` |
| Start | 73 | `{"Command": "change_cos model74.json"}` |
| Start | 74 | `{"Command": "change_cos model75.json"}` |
| Start | 75 | `{"Command": "change_cos model76.json"}` |
| Start | 76 | `{"Command": "change_cos model77.json"}` |
| Start | 77 | `{"Command": "change_cos model78.json"}` |
| Start | 78 | `{"Command": "change_cos model79.json"}` |
| Start | 79 | `{"Command": "change_cos model80.json"}` |
| Start | 80 | `{"Command": "change_cos model81.json"}` |
| Start | 81 | `{"Command": "change_cos model82.json"}` |
| Start | 82 | `{"Command": "change_cos model83.json"}` |
| Start | 83 | `{"Command": "change_cos model84.json"}` |
| Start | 84 | `{"Command": "change_cos model85.json"}` |
| Start | 85 | `{"Command": "change_cos model86.json"}` |
| Start | 86 | `{"Command": "change_cos model87.json"}` |
| Start | 87 | `{"Command": "change_cos model88.json"}` |
| Start | 88 | `{"Command": "change_cos model89.json"}` |
| Start | 89 | `{"Command": "change_cos model90.json"}` |
| Start | 90 | `{"Command": "change_cos model91.json"}` |
| Start | 91 | `{"Command": "change_cos model92.json"}` |
| Start | 92 | `{"Command": "change_cos model93.json"}` |
| Start | 93 | `{"Command": "change_cos model94.json"}` |
| Start | 94 | `{"Command": "change_cos model95.json"}` |
| Start | 95 | `{"Command": "change_cos model96.json"}` |
| Start | 96 | `{"Command": "change_cos model97.json"}` |
| Start | 97 | `{"Command": "change_cos model98.json"}` |
| Start | 98 | `{"Command": "change_cos model99.json"}` |
| Start | 99 | `{"Command": "change_cos model100.json"}` |
| Start | 100 | `{"Command": "change_cos model101.json"}` |
| Start | 101 | `{"Command": "change_cos model102.json"}` |
| Start | 102 | `{"Command": "change_cos model103.json"}` |
| Start | 103 | `{"Command": "change_cos model104.json"}` |
| Start | 104 | `{"Command": "change_cos model105.json"}` |
| Start | 105 | `{"Command": "change_cos model106.json"}` |
| Start | 106 | `{"Command": "change_cos model107.json"}` |
| Start | 107 | `{"Command": "change_cos model108.json"}` |
| Start | 108 | `{"Command": "change_cos model109.json"}` |
| Start | 109 | `{"Command": "change_cos model110.json"}` |
| Start | 110 | `{"Command": "change_cos model111.json"}` |
| Start | 111 | `{"Command": "change_cos model112.json"}` |
| Start | 112 | `{"Command": "change_cos model113.json"}` |
| Start | 113 | `{"Command": "change_cos model114.json"}` |
| Start | 114 | `{"Command": "change_cos model115.json"}` |
| Start | 115 | `{"Command": "change_cos model116.json"}` |
| Start | 116 | `{"Command": "change_cos model117.json"}` |
| Start | 117 | `{"Command": "change_cos model118.json"}` |
| Start | 118 | `{"Command": "change_cos model119.json"}` |
| Start | 119 | `{"Command": "change_cos model120.json"}` |
| Start | 120 | `{"Command": "change_cos model121.json"}` |
| Start | 121 | `{"Command": "change_cos model122.json"}` |
| Start | 122 | `{"Command": "change_cos model123.json"}` |
| Start | 123 | `{"Command": "change_cos model124.json"}` |
| Start | 124 | `{"Command": "change_cos model125.json"}` |
| Start | 125 | `{"Command": "change_cos model126.json"}` |
| Start | 126 | `{"Command": "change_cos model127.json"}` |
| Start | 127 | `{"Command": "change_cos model128.json"}` |
| Start | 128 | `{"Command": "change_cos model129.json"}` |
| Start | 129 | `{"Command": "change_cos model130.json"}` |
| Start | 130 | `{"Command": "change_cos model131.json"}` |
| Start | 131 | `{"Command": "change_cos model132.json"}` |
| Start | 132 | `{"Command": "change_cos model133.json"}` |
| Start | 133 | `{"Command": "change_cos model134.json"}` |
| Start | 134 | `{"Command": "change_cos model135.json"}` |
| Start | 135 | `{"Command": "change_cos model136.json"}` |
| Start | 136 | `{"Command": "change_cos model137.json"}` |
| Start | 137 | `{"Command": "change_cos model138.json"}` |
| Start | 138 | `{"Command": "change_cos model139.json"}` |
| Start | 139 | `{"Command": "change_cos model140.json"}` |
| Start | 140 | `{"Command": "change_cos model141.json"}` |
| Start | 141 | `{"Command": "change_cos model142.json"}` |
| Start | 142 | `{"Command": "change_cos model143.json"}` |
| Start | 143 | `{"Command": "change_cos model144.json"}` |
| Start | 144 | `{"Command": "change_cos model145.json"}` |
| Start | 145 | `{"Command": "change_cos model146.json"}` |
| Start | 146 | `{"Command": "change_cos model147.json"}` |
| Start | 147 | `{"Command": "change_cos model148.json"}` |
| Start | 148 | `{"Command": "change_cos model149.json"}` |
| Start | 149 | `{"Command": "change_cos model150.json"}` |
| Start | 150 | `{"Command": "change_cos model151.json"}` |
| Start | 151 | `{"Command": "change_cos model152.json"}` |
| Start | 152 | `{"Command": "change_cos model153.json"}` |
| Start | 153 | `{"Command": "change_cos model154.json"}` |
| Start | 154 | `{"Command": "change_cos model155.json"}` |
| Start | 155 | `{"Command": "change_cos model156.json"}` |
| Start | 156 | `{"Command": "change_cos model157.json"}` |
| Start | 157 | `{"Command": "change_cos model158.json"}` |
| Start | 158 | `{"Command": "change_cos model159.json"}` |
| Start | 159 | `{"Command": "change_cos model160.json"}` |
| Start | 160 | `{"Command": "change_cos model161.json"}` |
| Start | 161 | `{"Command": "change_cos model162.json"}` |
| Start | 162 | `{"Command": "change_cos model163.json"}` |
| Start | 163 | `{"Command": "change_cos model164.json"}` |
| Start | 164 | `{"Command": "change_cos model165.json"}` |
| Start | 165 | `{"Command": "change_cos model166.json"}` |
| Start | 166 | `{"Command": "change_cos model167.json"}` |
| Start | 167 | `{"Command": "change_cos model168.json"}` |
| Start | 168 | `{"Command": "change_cos model169.json"}` |
| Start | 169 | `{"Command": "change_cos model170.json"}` |
| Start | 170 | `{"Command": "change_cos model171.json"}` |
| Start | 171 | `{"Command": "change_cos model172.json"}` |
| Start | 172 | `{"Command": "change_cos model173.json"}` |
| Start | 173 | `{"Command": "change_cos model174.json"}` |
| Start | 174 | `{"Command": "change_cos model175.json"}` |
| Start | 175 | `{"Command": "change_cos model176.json"}` |
| Start | 176 | `{"Command": "change_cos model177.json"}` |
| Start | 177 | `{"Command": "change_cos model178.json"}` |
| Start | 178 | `{"Command": "change_cos model179.json"}` |
| Start | 179 | `{"Command": "change_cos model180.json"}` |
| Start | 180 | `{"Command": "change_cos model181.json"}` |
| Start | 181 | `{"Command": "change_cos model182.json"}` |
| Start | 182 | `{"Command": "change_cos model183.json"}` |
| Start | 183 | `{"Command": "change_cos model184.json"}` |
| Start | 184 | `{"Command": "change_cos model185.json"}` |
| Start | 185 | `{"Command": "change_cos model186.json"}` |
| Start | 186 | `{"Command": "change_cos model187.json"}` |
| Start | 187 | `{"Command": "change_cos model188.json"}` |
| Start | 188 | `{"Command": "change_cos model189.json"}` |
| Start | 189 | `{"Command": "change_cos model190.json"}` |
| Start | 190 | `{"Command": "change_cos model191.json"}` |
| Start | 191 | `{"Command": "change_cos model192.json"}` |
| Start | 192 | `{"Command": "change_cos model193.json"}` |
| Start | 193 | `{"Command": "change_cos model194.json"}` |
| Start | 194 | `{"Command": "change_cos model195.json"}` |
| Start | 195 | `{"Command": "change_cos model196.json"}` |
| Start | 196 | `{"Command": "change_cos model197.json"}` |
| Start | 197 | `{"Command": "change_cos model198.json"}` |
| Start | 198 | `{"Command": "change_cos model199.json"}` |
| Start | 199 | `{"Command": "change_cos model200.json"}` |
| Start | 200 | `{"Command": "change_cos model201.json"}` |
| Start | 201 | `{"Command": "change_cos model202.json"}` |
| Start | 202 | `{"Command": "change_cos model203.json"}` |
| Start | 203 | `{"Command": "change_cos model204.json"}` |
| Start | 204 | `{"Command": "change_cos model205.json"}` |
| Start | 205 | `{"Command": "change_cos model206.json"}` |
| Start | 206 | `{"Command": "change_cos model207.json"}` |
| Start | 207 | `{"Command": "change_cos model208.json"}` |
| Start | 208 | `{"Command": "change_cos model209.json"}` |
| Start | 209 | `{"Command": "change_cos model210.json"}` |
| Start | 210 | `{"Command": "change_cos model211.json"}` |
| Start | 211 | `{"Command": "change_cos model212.json"}` |
| Start | 212 | `{"Command": "change_cos model213.json"}` |
| Start | 213 | `{"Command": "change_cos model214.json"}` |
| Start | 214 | `{"Command": "change_cos model215.json"}` |
| Start | 215 | `{"Command": "change_cos model216.json"}` |
| Start | 216 | `{"Command": "change_cos model217.json"}` |
| Start | 217 | `{"Command": "change_cos model218.json"}` |
| Start | 218 | `{"Command": "change_cos model219.json"}` |
| Start | 219 | `{"Command": "change_cos model220.json"}` |
| Start | 220 | `{"Command": "change_cos model221.json"}` |
| Start | 221 | `{"Command": "change_cos model222.json"}` |
| Start | 222 | `{"Command": "change_cos model223.json"}` |
| Start | 223 | `{"Command": "change_cos model224.json"}` |
| Start | 224 | `{"Command": "change_cos model225.json"}` |
| Start | 225 | `{"Command": "change_cos model226.json"}` |
| Start | 226 | `{"Command": "change_cos model227.json"}` |
| Start | 227 | `{"Command": "change_cos model228.json"}` |

---

## 🎭 Model: `live2d_1990155125`
* **Windows Host Path**: `C:\users\h4rdc\Documents\Github\coding-agent\VRMs\packages_live2d\live2d_1990155125.zip`
Total custom entries pruned: **2**

| Group | Entry Name | Custom Properties (Special Sauce) |
| :--- | :--- | :--- |
| 1111 | 1 | `{"Command": "physics disable"}` |
| 1111 | 2 | `{"Command": "physics enable"}` |

---

## 🎭 Model: `live2d_2608633238`
* **Windows Host Path**: `C:\users\h4rdc\Documents\Github\coding-agent\VRMs\packages_live2d\live2d_2608633238.zip`
Total custom entries pruned: **1**

| Group | Entry Name | Custom Properties (Special Sauce) |
| :--- | :--- | :--- |
| Tap左石 | Entry 0 | `{"Text": "动作", "Choices": [{"Text": "开始", "NextMtn": "Tap左剑"}, {"Text": "回港", "NextMtn": "Tap剑"}, {"Text": "兔耳朵", "NextMtn": "Tap兔耳朵"}, {"Text": "腿环", "NextMtn": "Tap腿环"}, {"Text": "胸", "NextMtn": "Tap胸"}, {"Text": "左腿", "NextMtn": "Tap右腿"}, {"Text": "右腿", "NextMtn": "Tap左腿"}, {"Text": "脸", "NextMtn": "Tap脸"}, {"Text": "右手", "NextMtn": "Tap右手"}, {"Text": "左手", "NextMtn": "Tap左手"}, {"Text": "手指", "NextMtn": "Tap手指"}, {"Text": "腰", "NextMtn": "Tap腰"}, {"Text": "小黄鸡", "NextMtn": "Tap小黄鸡"}, {"Text": "兔尾巴", "NextMtn": "Tap兔尾巴"}], "Interruptable": true}` |

---

## 🎭 Model: `live2d_3357623873`
* **Windows Host Path**: `C:\users\h4rdc\Documents\Github\coding-agent\VRMs\packages_live2d\live2d_3357623873.zip`
Total custom entries pruned: **77**

| Group | Entry Name | Custom Properties (Special Sauce) |
| :--- | :--- | :--- |
| Taphead | head | `{"Sound": "Motions_Taphead_0_Sound_0.mp3", "Text": "摸头…什么的…", "Choices": [{}], "FadeIn": 400, "FadeOut": 400, "Expression": "motou", "TextDuration": 5000, "VarFloats": [{"Name": "moutoutime", "Type": 2, "Code": "add 1"}]}` |
| Taphead | moend | `{"Sound": "Motions_Taphead_1_Sound_0.mp3", "Text": "诶？就摸完了？", "Expression": "sup", "PostCommand": "clear_exp", "TextDuration": 3000}` |
| 其他功能组 | clear | `{"Expression": "clear"}` |
| 其他功能组 | 没摇过头 | `{"Priority": 3, "NextMtn": "其他功能组:摇过头", "VarFloats": [{"Name": "yun", "Type": 1, "Code": "lower_equal 8"}, {"Name": "yun", "Type": 2, "Code": "assign rand(1,8)"}, {"Name": "chouqutime", "Type": 2, "Code": "add 1"}]}` |
| 其他功能组 | 待机语音 | `{"Text": "待机语音选项", "Choices": [{"Text": "静音待机语音", "NextMtn": "Tap发夹:静音"}, {"Text": "恢复待机语音", "NextMtn": "Tap发夹:开音"}, {"Text": "开启嘴型同步", "NextMtn": "Tap发夹:同步开启"}, {"Text": "关闭嘴型同步", "NextMtn": "Tap发夹:同步关闭"}], "TextDuration": 5000}` |
| Tapjio | jio | `{"Sound": "Motions_Tapjio_0_Sound_0.mp3", "Text": "诶诶！？", "Expression": "grab", "TextDuration": 5000, "VarFloats": [{"Name": "jiotime", "Type": 2, "Code": "add 1"}]}` |
| Tapjio | jioend | `{"Text": "…", "Expression": "angry", "PostCommand": "clear_exp", "TextDuration": 3000, "MotionDuration": 2000, "Priority": 3}` |
| Tapjio | jioend2 | `{"Text": "……", "Expression": "angry", "PostCommand": "clear_exp", "TextDuration": 3000, "MotionDuration": 2000, "Priority": 3}` |
| Tap呆毛 | 抓呆毛 | `{"Sound": "Motions_Tapjio_0_Sound_0.mp3", "Text": "唔唔唔！！！", "Expression": "drag", "TextDuration": 5000, "Interruptable": true, "VarFloats": [{"Name": "daimaotime", "Type": 2, "Code": "add 1"}]}` |
| Tap呆毛 | 呆毛end | `{"Sound": "Motions_Tap呆毛_1_Sound_0.mp3", "Text": "干什么！", "Expression": "angry", "PostCommand": "clear_exp", "TextDuration": 3000}` |
| Tap发夹 | 开始菜单 | `{"Text": "开始菜单", "Choices": [{"Text": "电源选项", "NextMtn": "Tap发夹:电源选项"}, {"Text": "当前日期和时间", "NextMtn": "Tap发夹:时间日期"}, {"Text": "自我介绍", "NextMtn": "Tap发夹:自我介绍"}, {"Text": "动作菜单", "NextMtn": "动作组调用:动作菜单"}, {"Text": "表情菜单", "NextMtn": "表情调用:表情菜单"}, {"Text": "数据统计", "NextMtn": "Tap发夹:数据统计"}, {"Text": "语音选项", "NextMtn": "其他功能组:待机语音"}, {"Text": "随机说话", "NextMtn": "语音组"}], "TextDuration": 10000, "MotionDuration": 10000, "VarFloats": [{"Name": "starttime", "Type": 2, "Code": "add 1"}]}` |
| Tap发夹 | smile | `{"Sound": "Motions_Tap发夹_1_Sound_0.mp3", "Text": "休对故人思故国，且将新火试新茶。敬请开始吧！", "Command": "clear_exp", "PostCommand": "clear_exp", "MotionDuration": 3000}` |
| Tap发夹 | sleep | `{"Sound": "Motions_Tap发夹_2_Sound_0.mp3", "Text": "更新并关机（预计时间：5分钟）", "Expression": "sleep", "TextDuration": 3000, "OverrideFaceParams": true}` |
| Tap发夹 | 时间日期 | `{"Sound": "Motions_Tap发夹_3_Sound_0.mp3", "Text": "用户{$username}您好！{$br}当前时间是：{$timenow}{$br}当前日期为：{$datenow}", "PostCommand": "clear_exp", "TextDuration": 5000, "MotionDuration": 5000, "VarFloats": [{"Name": "shijiantime", "Type": 2, "Code": "add 1"}]}` |
| Tap发夹 | 自我介绍 | `{"Sound": "Motions_Tap发夹_4_Sound_0.mp3", "Text": "用户{$username}您好！我是{$assistant}！{$br}欢迎您使用Windows 11 24H2系统！", "PostCommand": "clear_exp", "TextDuration": 5000, "MotionDuration": 5000}` |
| Tap发夹 | 电源选项 | `{"Text": "电源选项（模型）", "Choices": [{"Text": "开机", "NextMtn": "Tap发夹:smile"}, {"Text": "关机", "NextMtn": "Tap发夹:sleep"}]}` |
| Tap发夹 | 数据统计 | `{"Sound": "Motions_Tap发夹_6_Sound_0.mp3", "Text": "摸头次数：{$vi_moutoutime}{$br}摸足次数：{$vi_jiotime}{$br}拽呆毛次数：{$vi_daimaotime}{$br}开始菜单启动次数：{$vi_starttime}{$br}时间查询次数：{$vi_shijiantime}{$br}待机动作触发次数：{$vi_daijitime}{$br}摇头眩晕判定值：{$vi_yun}（大于7触发）{$br}摇头判定次数：{$vi_chouqutime}{$br}眩晕触发次数：{$vi_chufatime}{$br}以上变量须触发一次后方显示正常计数", "TextDuration": 10000}` |
| Tap发夹 | 静音 | `{"Text": "待机语音已静音", "PostCommand": "mute_sound 1", "TextDuration": 3000, "VarFloats": [{"Name": "mute", "Type": 1, "Code": "equal 0"}, {"Name": "mute", "Type": 2, "Code": "assign 1"}]}` |
| Tap发夹 | 开音 | `{"Text": "待机语音已启用", "PostCommand": "unmute_sound 1", "TextDuration": 3000, "VarFloats": [{"Name": "mute", "Type": 1, "Code": "equal 1"}, {"Name": "mute", "Type": 2, "Code": "assign 0"}]}` |
| Tap发夹 | 同步开启 | `{"Text": "嘴型同步已开启", "PostCommand": "lip_sync enable", "TextDuration": 3000, "VarFloats": [{"Name": "lip", "Type": 1, "Code": "equal 1"}, {"Name": "lip", "Type": 2, "Code": "assign 0"}]}` |
| Tap发夹 | 同步关闭 | `{"Text": "嘴型同步已关闭", "PostCommand": "lip_sync disable;parameters set ParamMouthForm $ko 0", "TextDuration": 3000, "VarFloats": [{"Name": "lip", "Type": 1, "Code": "equal 0"}, {"Name": "lip", "Type": 2, "Code": "assign 1"}, {"Name": "ko", "Type": 2, "Code": "assign 0"}]}` |
| 动作组调用 | 动作菜单 | `{"Text": "动作菜单", "Choices": [{"Text": "犯困", "NextMtn": "动作组调用:犯困"}, {"Text": "观察", "NextMtn": "动作组调用:视奸"}, {"Text": "晕眩", "NextMtn": "Shakephone:摇动"}, {"Text": "俯卧撑", "NextMtn": "动作组调用:俯卧撑"}, {"Text": "晃头", "NextMtn": "动作组调用:晃头"}, {"Text": "清除动作", "NextMtn": "Tap身体:清除动作"}, {"Text": "返回上一级", "NextMtn": "Tap发夹:开始菜单"}, {"Text": "关闭菜单"}], "TextDuration": 10000, "MotionDuration": 10000}` |
| Leave5_10_20 | AI | `{"Sound": "Motions_Leave5_10_20_4_Sound_0.mp3", "SoundChannel": 1, "Text": "AI扰乱了行业。请加入我们，{$br}我们还要进一步扰乱行业。"}` |
| Leave5_10_20 | TM关机 | `{"Sound": "Motions_Leave5_10_20_5_Sound_0.mp3", "SoundChannel": 1, "Text": "请勿™关闭计算机"}` |
| Leave5_10_20 | win10人 | `{"Sound": "Motions_Leave5_10_20_6_Sound_0.mp3", "SoundChannel": 1, "Text": "Windows 10 不是面向我们所有人，{$br}而是面向我们每一个人。"}` |
| Leave5_10_20 | win10事情 | `{"Sound": "Motions_Leave5_10_20_7_Sound_0.mp3", "SoundChannel": 1, "Text": "做\r，轰！\r嚓-嚓-嚓\r，推-推\r，的事！"}` |
| Leave5_10_20 | 边缘 | `{"Sound": "Motions_Leave5_10_20_8_Sound_0.mp3", "SoundChannel": 1, "Text": "用微软边缘粉碎你的工作日！"}` |
| Leave5_10_20 | 准备更新 | `{"Sound": "Motions_Leave5_10_20_9_Sound_0.mp3", "SoundChannel": 1, "Text": "请君莫奏前朝曲，听唱新翻杨柳枝。{$br}正在准备更新，请勿关闭电脑。"}` |
| Leave5_10_20 | 奖励自己 | `{"Sound": "Motions_Leave5_10_20_10_Sound_0.mp3", "SoundChannel": 1, "Text": "今日奖励白己{$br}Microsoft Rewards 可帮助您{$br}在获得奖励的同时充满动力地完成目标"}` |
| Leave5_10_20 | 头好 | `{"Sound": "Motions_Leave5_10_20_11_Sound_0.mp3", "SoundChannel": 1, "Text": "头抬起，好东西就要来了"}` |
| Leave5_10_20 | 反馈 | `{"Sound": "Motions_Leave5_10_20_12_Sound_0.mp3", "SoundChannel": 1, "Text": "Microsoft 反馈{$br}您仍有时间把您的想法告诉微软"}` |
| Leave5_10_20 | 成功 | `{"Sound": "Motions_Leave5_10_20_13_Sound_0.mp3", "SoundChannel": 1, "Text": "是的，你正在成功。\r{$br}头抬起，窗10系统的内部集线器新增了《语言社区》，{$br}可用于你的电脑（是的，你的电脑）。{$br}我十分激动，无法坐和放宽。{$br}你正在成功，不再需要以前的版本。{$br}从此，按下功率，{$br}轰！嚓-嚓-嚓！推推。\r{$br}", "MotionDuration": 30000}` |
| Leave5_10_20 | 战胜机器人 | `{"Sound": "Motions_Leave5_10_20_14_Sound_0.mp3", "SoundChannel": 1, "Text": "帮助我们战胜机器人，{$br}请回答问题以确保你不是机器人"}` |
| Leave5_10_20 | 日日新 | `{"Sound": "Motions_Leave5_10_20_15_Sound_0.mp3", "SoundChannel": 1, "Text": "日日新，又日新。{$br}我们已经更新了你的电脑，快来试试吧！"}` |
| Leave5_10_20 | 更新完成 | `{"Sound": "Motions_Leave5_10_20_16_Sound_0.mp3", "SoundChannel": 1, "Text": "潮平两岸阔，风正一帆悬。{$br}更新现已完成，精彩旅程即将开启。"}` |
| Leave5_10_20 | 海内存知己 | `{"Sound": "Motions_Leave5_10_20_17_Sound_0.mp3", "SoundChannel": 1, "Text": "海内存知己，天涯若比邻。{$br}请稍等…"}` |
| Leave5_10_20 | 游戏模式 | `{"Sound": "Motions_Leave5_10_20_18_Sound_0.mp3", "SoundChannel": 1, "Text": "当你使用游戏模式时，{$br}Windows 会在后台关闭游戏来优化你的游戏体验。"}` |
| Leave5_10_20 | 海内存知己 | `{"Sound": "Motions_Leave5_10_20_19_Sound_0.mp3", "SoundChannel": 1, "Text": "请滚回功率，坐和放宽"}` |
| Leave5_10_20 | 老牛拉破车 | `{"Sound": "Motions_Leave5_10_20_20_Sound_0.mp3", "SoundChannel": 1, "Text": "有时候网速极慢，如同老牛拉破车，{$br}请确保网络正常畅通，然后再次尝试。"}` |
| Leave5_10_20 | 聪明 | `{"Sound": "Motions_Leave5_10_20_21_Sound_0.mp3", "SoundChannel": 1, "Text": "你今天看起来很聪明，{$username}"}` |
| Leave5_10_20 | 警告 | `{"Sound": "Motions_Leave5_10_20_22_Sound_0.mp3", "SoundChannel": 1, "Text": "不要说我们没有警告过你…{$br}如果您选择不接收电子邮件，{$br}那么这是您将收到的最后一封电子邮件。"}` |
| Leave5_10_20 | 不是人 | `{"Sound": "Motions_Leave5_10_20_23_Sound_0.mp3", "SoundChannel": 1, "Text": "已发生错误，{$br}你看起来不是人。请再次尝试人类。"}` |
| Leave5_10_20 | 需要时间 | `{"Sound": "Motions_Leave5_10_20_24_Sound_0.mp3", "SoundChannel": 1, "Text": "路漫漫其修远兮，吾将上下而求索。{$br}这可能需要一段时间。"}` |
| Leave5_10_20 | 出错了 | `{"Sound": "Motions_Leave5_10_20_25_Sound_0.mp3", "SoundChannel": 1, "Text": "出错了，但我们做对了。请尝试刷新或稍后返回。"}` |
| Leave5_10_20 | 别来无恙 | `{"Sound": "Motions_Leave5_10_20_26_Sound_0.mp3", "SoundChannel": 1, "Text": "与君初相识，犹如故人归。{$br}嗨，别来无恙啊！"}` |
| 表情调用 | 表情菜单 | `{"Text": "表情菜单", "Choices": [{"Text": "生气", "NextMtn": "表情调用:生气"}, {"Text": "害羞", "NextMtn": "表情调用:害羞"}, {"Text": "闭眼笑", "NextMtn": "表情调用:摸头"}, {"Text": "惊讶", "NextMtn": "表情调用:惊讶"}, {"Text": "拽呆毛", "NextMtn": "表情调用:抓住"}, {"Text": "微笑", "NextMtn": "表情调用:不舍"}, {"Text": "睡觉", "NextMtn": "表情调用:睡觉"}, {"Text": "清除表情", "NextMtn": "clear:clear"}, {"Text": "返回上一级", "NextMtn": "Tap发夹:开始菜单"}, {"Text": "关闭菜单"}], "TextDuration": 10000, "MotionDuration": 10000}` |
| 表情调用 | 生气 | `{"Expression": "angry"}` |
| 表情调用 | 害羞 | `{"Expression": "grab"}` |
| 表情调用 | 摸头 | `{"Expression": "motou"}` |
| 表情调用 | 惊讶 | `{"Expression": "sup"}` |
| 表情调用 | 抓住 | `{"Expression": "drag"}` |
| 表情调用 | 不舍 | `{"Expression": "smile"}` |
| 表情调用 | 睡觉 | `{"Expression": "sleep"}` |
| 表情调用 | 清除表情 | `{"Expression": "clear"}` |
| 语音组 | AI | `{"Sound": "Motions_Leave5_10_20_4_Sound_0.mp3", "Text": "AI扰乱了行业。请加入我们，{$br}我们还要进一步扰乱行业。"}` |
| 语音组 | TM关机 | `{"Sound": "Motions_Leave5_10_20_5_Sound_0.mp3", "Text": "请勿™关闭计算机"}` |
| 语音组 | win10人 | `{"Sound": "Motions_Leave5_10_20_6_Sound_0.mp3", "Text": "Windows 10 不是面向我们所有人，{$br}而是面向我们每一个人。"}` |
| 语音组 | win10事情 | `{"Sound": "Motions_Leave5_10_20_7_Sound_0.mp3", "Text": "做\r，轰！\r嚓-嚓-嚓\r，推-推\r，的事！"}` |
| 语音组 | 边缘 | `{"Sound": "Motions_Leave5_10_20_8_Sound_0.mp3", "Text": "用微软边缘粉碎你的工作日！"}` |
| 语音组 | 准备更新 | `{"Sound": "Motions_Leave5_10_20_9_Sound_0.mp3", "Text": "请君莫奏前朝曲，听唱新翻杨柳枝。{$br}正在准备更新，请勿关闭电脑。"}` |
| 语音组 | 奖励自己 | `{"Sound": "Motions_Leave5_10_20_10_Sound_0.mp3", "Text": "今日奖励白己{$br}Microsoft Rewards 可帮助您{$br}在获得奖励的同时充满动力地完成目标"}` |
| 语音组 | 头好 | `{"Sound": "Motions_Leave5_10_20_11_Sound_0.mp3", "Text": "头抬起，好东西就要来了"}` |
| 语音组 | 反馈 | `{"Sound": "Motions_Leave5_10_20_12_Sound_0.mp3", "Text": "Microsoft 反馈{$br}您仍有时间把您的想法告诉微软"}` |
| 语音组 | 成功 | `{"Sound": "Motions_Leave5_10_20_13_Sound_0.mp3", "Text": "是的，你正在成功。\r{$br}头抬起，窗10系统的内部集线器新增了《语言社区》，{$br}可用于你的电脑（是的，你的电脑）。{$br}我十分激动，无法坐和放宽。{$br}你正在成功，不再需要以前的版本。{$br}从此，按下功率，{$br}轰！嚓-嚓-嚓！推推。\r{$br}", "MotionDuration": 30000}` |
| 语音组 | 战胜机器人 | `{"Sound": "Motions_Leave5_10_20_14_Sound_0.mp3", "Text": "帮助我们战胜机器人，{$br}请回答问题以确保你不是机器人"}` |
| 语音组 | 日日新 | `{"Sound": "Motions_Leave5_10_20_15_Sound_0.mp3", "Text": "日日新，又日新。{$br}我们已经更新了你的电脑，快来试试吧！"}` |
| 语音组 | 更新完成 | `{"Sound": "Motions_Leave5_10_20_16_Sound_0.mp3", "Text": "潮平两岸阔，风正一帆悬。{$br}更新现已完成，精彩旅程即将开启。"}` |
| 语音组 | 海内存知己 | `{"Sound": "Motions_Leave5_10_20_17_Sound_0.mp3", "Text": "海内存知己，天涯若比邻。{$br}请稍等…"}` |
| 语音组 | 游戏模式 | `{"Sound": "Motions_Leave5_10_20_18_Sound_0.mp3", "Text": "当你使用游戏模式时，{$br}Windows 会在后台关闭游戏来优化你的游戏体验。"}` |
| 语音组 | 海内存知己 | `{"Sound": "Motions_Leave5_10_20_19_Sound_0.mp3", "Text": "请滚回功率，坐和放宽"}` |
| 语音组 | 老牛拉破车 | `{"Sound": "Motions_Leave5_10_20_20_Sound_0.mp3", "Text": "有时候网速极慢，如同老牛拉破车，{$br}请确保网络正常畅通，然后再次尝试。"}` |
| 语音组 | 聪明 | `{"Sound": "Motions_Leave5_10_20_21_Sound_0.mp3", "Text": "你今天看起来很聪明，{$username}"}` |
| 语音组 | 警告 | `{"Sound": "Motions_Leave5_10_20_22_Sound_0.mp3", "Text": "不要说我们没有警告过你…{$br}如果您选择不接收电子邮件，{$br}那么这是您将收到的最后一封电子邮件。"}` |
| 语音组 | 不是人 | `{"Sound": "Motions_Leave5_10_20_23_Sound_0.mp3", "Text": "已发生错误，{$br}你看起来不是人。请再次尝试人类。"}` |
| 语音组 | 需要时间 | `{"Sound": "Motions_Leave5_10_20_24_Sound_0.mp3", "Text": "路漫漫其修远兮，吾将上下而求索。{$br}这可能需要一段时间。"}` |
| 语音组 | 出错了 | `{"Sound": "Motions_Leave5_10_20_25_Sound_0.mp3", "Text": "出错了，但我们做对了。请尝试刷新或稍后返回。"}` |
| 语音组 | 别来无恙 | `{"Sound": "Motions_Leave5_10_20_26_Sound_0.mp3", "SoundChannel": 1, "Text": "与君初相识，犹如故人归。{$br}嗨，别来无恙啊！"}` |

---

## 🎭 Model: `live2d_3156427156`
* **Windows Host Path**: `C:\users\h4rdc\Documents\Github\coding-agent\VRMs\packages_live2d_multi\live2d_3156427156.zip`
Total custom entries pruned: **8**

| Group | Entry Name | Custom Properties (Special Sauce) |
| :--- | :--- | :--- |
| Switch | Settings_All_voice_On | `{"Command": "change_cos model1.json"}` |
| Switch | Settings_All_voice_Off | `{"Command": "change_cos model2.json"}` |
| Switch | Settings_Idle_voice_On | `{"Command": "change_cos model3.json"}` |
| Switch | Settings_Idle_voice_Off | `{"Command": "change_cos model4.json"}` |
| Voice Setting | Voice Setting | `{"Text": "Voice Setting", "Choices": [{"Text": "All Voice Setting", "NextMtn": "Voice Setting:All Voice Setting"}, {"Text": "Idle Voice Setting", "NextMtn": "Voice Setting:Idle Voice Setting"}, {"Text": "Cancel"}]}` |
| Voice Setting | All Voice Setting | `{"Text": "All Voice Setting", "Choices": [{"Text": "ON", "NextMtn": "Switch:Settings_All_voice_On"}, {"Text": "OFF", "NextMtn": "Switch:Settings_All_voice_Off"}, {"Text": "CANCEL"}]}` |
| Voice Setting | Idle Voice Setting | `{"Text": "Idle Voice Setting", "Choices": [{"Text": "ON", "NextMtn": "Switch:Settings_Idle_voice_On"}, {"Text": "OFF", "NextMtn": "Switch:Settings_Idle_voice_Off"}, {"Text": "CANCEL"}]}` |
| Settings | Settings | `{"Text": "Settings", "Choices": [{"Text": "Voice Setting", "NextMtn": "Voice Setting:Voice Setting"}, {"Text": "Cancel"}]}` |

---

## 🎭 Model: `live2d_3599090981`
* **Windows Host Path**: `C:\users\h4rdc\Documents\Github\coding-agent\VRMs\packages_live2d\live2d_3599090981.zip`
Total custom entries pruned: **1**

| Group | Entry Name | Custom Properties (Special Sauce) |
| :--- | :--- | :--- |
| Expressions | 提衣服脸红.motion3 | `{}` |

---

## 🎭 Model: `live2d_3443582462`
* **Windows Host Path**: `C:\users\h4rdc\Documents\Github\coding-agent\VRMs\packages_live2d\live2d_3443582462.zip`
Total custom entries pruned: **8**

| Group | Entry Name | Custom Properties (Special Sauce) |
| :--- | :--- | :--- |
| init#2 | init | `{"PostCommand": "start_mtn init#2:init_bg", "VarFloats": [{"Name": "hide_bg_status", "Type": 2, "Code": "init 0"}]}` |
| init#2 | init_bg | `{"PostCommand": "parts lock Part74,Part66 0", "VarFloats": [{"Name": "hide_bg_status", "Type": 1, "Code": "equal 1"}]}` |
| bg#2 | hide | `{"PostCommand": "parts lock Part74,Part66 0", "VarFloats": [{"Name": "hide_bg_status", "Type": 1, "Code": "equal 0"}, {"Name": "hide_bg_status", "Type": 2, "Code": "assign 1"}]}` |
| bg#2 | show | `{"PostCommand": "parts unlock Part74,Part66;parts set Part74,Part66 1", "VarFloats": [{"Name": "hide_bg_status", "Type": 1, "Code": "equal 1"}, {"Name": "hide_bg_status", "Type": 2, "Code": "assign 0"}]}` |
| menu#2 | menu | `{"Text": "语音鉴赏", "Choices": [{"Text": "登录", "NextMtn": "select:login"}, {"Text": "任务提醒", "NextMtn": "select:mission"}, {"Text": "任务完成", "NextMtn": "select:mission_complete"}, {"Text": "邮件提醒", "NextMtn": "select:mail"}, {"Text": "回港", "NextMtn": "select:home"}, {"Text": "誓约", "NextMtn": "select:wedding"}, {"Text": "委托完成", "NextMtn": "select:complete"}, {"Text": "切换背景", "NextMtn": "bg#2"}], "TextDuration": 5000}` |
| menu#2 | menu_en | `{"Text": "Voice Gallery", "Choices": [{"Text": "Log In", "NextMtn": "select:login_en"}, {"Text": "Mission Reminder", "NextMtn": "select:mission_en"}, {"Text": "Mission Complete", "NextMtn": "select:mission_complete_en"}, {"Text": "Mail Reminder", "NextMtn": "select:mail_en"}, {"Text": "Return to Port", "NextMtn": "select:home_en"}, {"Text": "Promise", "NextMtn": "select:wedding_en"}, {"Text": "Commission Complete", "NextMtn": "select:complete_en"}, {"Text": "Toggle Background", "NextMtn": "bg#2"}], "TextDuration": 5000, "Language": "en"}` |
| body | main | `{"Command": "start_mtn Tap", "Weight": 3}` |
| body | main_en | `{"Command": "start_mtn Tap", "Weight": 3, "Language": "en"}` |

---

## 🎭 Model: `live2d_3443588788`
* **Windows Host Path**: `C:\users\h4rdc\Documents\Github\coding-agent\VRMs\packages_live2d\live2d_3443588788.zip`
Total custom entries pruned: **11**

| Group | Entry Name | Custom Properties (Special Sauce) |
| :--- | :--- | :--- |
| init#2 | init | `{"PostCommand": "start_mtn init#2:init_bg;start_mtn init#2:init_blush", "VarFloats": [{"Name": "hide_bg_status", "Type": 2, "Code": "init 0"}, {"Name": "blush", "Type": 2, "Code": "init 0"}]}` |
| init#2 | init_bg | `{"PostCommand": "parts lock Part33,Part95,Part,Part75,Part70,Part97 0", "VarFloats": [{"Name": "hide_bg_status", "Type": 1, "Code": "equal 1"}]}` |
| init#2 | init_blush | `{"PostCommand": "parameters lock ParamCheek 1", "VarFloats": [{"Name": "blush", "Type": 1, "Code": "equal 1"}]}` |
| bg#2 | hide | `{"PostCommand": "parts lock Part33,Part95,Part,Part75,Part70,Part97 0", "VarFloats": [{"Name": "hide_bg_status", "Type": 1, "Code": "equal 0"}, {"Name": "hide_bg_status", "Type": 2, "Code": "assign 1"}]}` |
| bg#2 | show | `{"PostCommand": "parts unlock Part33,Part95,Part,Part75,Part70,Part97;parts set Part33,Part95,Part,Part75,Part70,Part97 1", "VarFloats": [{"Name": "hide_bg_status", "Type": 1, "Code": "equal 1"}, {"Name": "hide_bg_status", "Type": 2, "Code": "assign 0"}]}` |
| blush#2 | set_1 | `{"PostCommand": "parameters lock ParamCheek 1", "VarFloats": [{"Name": "blush", "Type": 1, "Code": "equal 0"}, {"Name": "blush", "Type": 2, "Code": "assign 1"}]}` |
| blush#2 | set_0 | `{"PostCommand": "parameters unlock ParamCheek", "VarFloats": [{"Name": "blush", "Type": 1, "Code": "equal 1"}, {"Name": "blush", "Type": 2, "Code": "assign 0"}]}` |
| menu#2 | menu | `{"Text": "语音鉴赏", "Choices": [{"Text": "登录", "NextMtn": "select:login"}, {"Text": "任务提醒", "NextMtn": "select:mission"}, {"Text": "任务完成", "NextMtn": "select:mission_complete"}, {"Text": "邮件提醒", "NextMtn": "select:mail"}, {"Text": "回港", "NextMtn": "select:home"}, {"Text": "誓约", "NextMtn": "select:wedding"}, {"Text": "委托完成", "NextMtn": "select:complete"}, {"Text": "切换背景", "NextMtn": "bg#2"}, {"Text": "切换脸红", "NextMtn": "blush#2"}], "TextDuration": 5000}` |
| menu#2 | menu_en | `{"Text": "Voice Gallery", "Choices": [{"Text": "Log In", "NextMtn": "select:login_en"}, {"Text": "Mission Reminder", "NextMtn": "select:mission_en"}, {"Text": "Mission Complete", "NextMtn": "select:mission_complete_en"}, {"Text": "Mail Reminder", "NextMtn": "select:mail_en"}, {"Text": "Return to Port", "NextMtn": "select:home_en"}, {"Text": "Promise", "NextMtn": "select:wedding_en"}, {"Text": "Commission Complete", "NextMtn": "select:complete_en"}, {"Text": "Toggle Background", "NextMtn": "bg#2"}, {"Text": "Toggle Blush", "NextMtn": "blush#2"}], "TextDuration": 5000, "Language": "en"}` |
| body | main | `{"Command": "start_mtn Tap", "Weight": 3}` |
| body | main_en | `{"Command": "start_mtn Tap", "Weight": 3, "Language": "en"}` |

---

## 🎭 Model: `live2d_3443578669`
* **Windows Host Path**: `C:\users\h4rdc\Documents\Github\coding-agent\VRMs\packages_live2d\live2d_3443578669.zip`
Total custom entries pruned: **11**

| Group | Entry Name | Custom Properties (Special Sauce) |
| :--- | :--- | :--- |
| init#2 | init | `{"PostCommand": "start_mtn init#2:init_bg;start_mtn init#2:init_blush", "VarFloats": [{"Name": "hide_bg_status", "Type": 2, "Code": "init 0"}, {"Name": "blush", "Type": 2, "Code": "init 0"}]}` |
| init#2 | init_bg | `{"PostCommand": "parts lock PartManju,PartBatall,PartLongbeltR,PartJzL,PartjkR,Part4,PartLongbelt_l 0", "VarFloats": [{"Name": "hide_bg_status", "Type": 1, "Code": "equal 1"}]}` |
| init#2 | init_blush | `{"PostCommand": "parameters lock ParamCheek 1", "VarFloats": [{"Name": "blush", "Type": 1, "Code": "equal 1"}]}` |
| bg#2 | hide | `{"PostCommand": "parts lock PartManju,PartBatall,PartLongbeltR,PartJzL,PartjkR,Part4,PartLongbelt_l 0", "VarFloats": [{"Name": "hide_bg_status", "Type": 1, "Code": "equal 0"}, {"Name": "hide_bg_status", "Type": 2, "Code": "assign 1"}]}` |
| bg#2 | show | `{"PostCommand": "parts unlock PartManju,PartBatall,PartLongbeltR,PartJzL,PartjkR,Part4,PartLongbelt_l;parts set PartManju,PartBatall,PartLongbeltR,PartJzL,PartjkR,Part4,PartLongbelt_l 1", "VarFloats": [{"Name": "hide_bg_status", "Type": 1, "Code": "equal 1"}, {"Name": "hide_bg_status", "Type": 2, "Code": "assign 0"}]}` |
| blush#2 | set_1 | `{"PostCommand": "parameters lock ParamCheek 1", "VarFloats": [{"Name": "blush", "Type": 1, "Code": "equal 0"}, {"Name": "blush", "Type": 2, "Code": "assign 1"}]}` |
| blush#2 | set_0 | `{"PostCommand": "parameters unlock ParamCheek", "VarFloats": [{"Name": "blush", "Type": 1, "Code": "equal 1"}, {"Name": "blush", "Type": 2, "Code": "assign 0"}]}` |
| menu#2 | menu | `{"Text": "语音鉴赏", "Choices": [{"Text": "登录", "NextMtn": "select:login"}, {"Text": "任务提醒", "NextMtn": "select:mission"}, {"Text": "任务完成", "NextMtn": "select:mission_complete"}, {"Text": "邮件提醒", "NextMtn": "select:mail"}, {"Text": "回港", "NextMtn": "select:home"}, {"Text": "誓约", "NextMtn": "select:wedding"}, {"Text": "委托完成", "NextMtn": "select:complete"}, {"Text": "切换舰装", "NextMtn": "bg#2"}, {"Text": "切换脸红", "NextMtn": "blush#2"}], "TextDuration": 5000}` |
| menu#2 | menu_en | `{"Text": "Voice Gallery", "Choices": [{"Text": "Log In", "NextMtn": "select:login_en"}, {"Text": "Mission Reminder", "NextMtn": "select:mission_en"}, {"Text": "Mission Complete", "NextMtn": "select:mission_complete_en"}, {"Text": "Mail Reminder", "NextMtn": "select:mail_en"}, {"Text": "Return to Port", "NextMtn": "select:home_en"}, {"Text": "Promise", "NextMtn": "select:wedding_en"}, {"Text": "Commission Complete", "NextMtn": "select:complete_en"}, {"Text": "Toggle Equipment", "NextMtn": "bg#2"}, {"Text": "Toggle Blush", "NextMtn": "blush#2"}], "TextDuration": 5000, "Language": "en"}` |
| body | main | `{"Command": "start_mtn Tap1", "Weight": 3}` |
| body | main_en | `{"Command": "start_mtn Tap1", "Weight": 3, "Language": "en"}` |

---

## 🎭 Model: `live2d_3607861780`
* **Windows Host Path**: `C:\users\h4rdc\Documents\Github\coding-agent\VRMs\packages_live2d\live2d_3607861780.zip`
Total custom entries pruned: **13**

| Group | Entry Name | Custom Properties (Special Sauce) |
| :--- | :--- | :--- |
| 其他组#3 | 回正 | `{"WrapMode": 2, "Expression": "expression0.exp3", "NextMtn": "动作组#2:回正"}` |
| 其他组#3 | 眼镜上（点击） | `{"Expression": "expression0.exp3"}` |
| 其他组#3 | 眼镜下（点击） | `{"Expression": "expression1.exp3"}` |
| 其他组#3 | 眼镜切换（点击） | `{"Expression": "expression2.exp3"}` |
| 动作组#2 | 回正 | `{"WrapMode": 2, "Expression": "expression0.exp3", "VarFloats": [{"Name": "stop", "Type": 2, "Code": "assign 0"}]}` |
| 动作组#2 | 抽卡（点击） | `{"WrapMode": 2, "Expression": "expression10.exp3", "Priority": 6, "VarFloats": [{"Name": "stop", "Type": 2, "Code": "assign 1"}]}` |
| 动作组#2 | 问号（按键） | `{"Expression": "expression3.exp3", "VarFloats": [{"Name": "stop", "Type": 2, "Code": "assign 1"}]}` |
| 动作组#2 | 鄙夷（按键） | `{"Expression": "expression4.exp3", "VarFloats": [{"Name": "stop", "Type": 2, "Code": "assign 1"}]}` |
| 动作组#2 | 呆住（按键） | `{"Expression": "expression5.exp3", "VarFloats": [{"Name": "stop", "Type": 2, "Code": "assign 1"}]}` |
| 动作组#2 | 挺好（按键） | `{"Expression": "expression6.exp3", "VarFloats": [{"Name": "stop", "Type": 2, "Code": "assign 1"}]}` |
| 动作组#2 | 麦霸（按键） | `{"Expression": "expression7.exp3", "VarFloats": [{"Name": "stop", "Type": 2, "Code": "assign 1"}]}` |
| 动作组#2 | 经典（按键） | `{"Expression": "expression8.exp3", "VarFloats": [{"Name": "stop", "Type": 2, "Code": "assign 1"}]}` |
| 动作组#2 | 白眼（按键） | `{"Expression": "expression9.exp3", "VarFloats": [{"Name": "stop", "Type": 2, "Code": "assign 1"}]}` |

---

## 🎭 Model: `live2d_3690055082`
* **Windows Host Path**: `C:\users\h4rdc\Documents\Github\coding-agent\VRMs\packages_live2d\live2d_3690055082.zip`
Total custom entries pruned: **13**

| Group | Entry Name | Custom Properties (Special Sauce) |
| :--- | :--- | :--- |
| R | 1 | `{"PostCommand": "change_model kokona_chinkagi_fellatio/255/1.model3.json", "Priority": 2, "Weight": 2}` |
| R | 2 | `{"PostCommand": "change_model live2d_mari_idol/397/1.model3.json", "Priority": 2, "Weight": 2}` |
| R | 3 | `{"PostCommand": "change_model イブキちゃんセックス固め/237/1.model3.json", "Priority": 2, "Weight": 2}` |
| R | 4 | `{"PostCommand": "change_model キサキ搾精フェラ/364/1.model3.json", "Priority": 2, "Weight": 2}` |
| R | 5 | `{"PostCommand": "change_model シュエリンベロチュー手コキ/162/1.model3.json", "Priority": 2, "Weight": 2}` |
| R | 6 | `{"PostCommand": "change_model シュエリン皮むきねっとりフェラ/215/1.model3.json", "Priority": 2, "Weight": 2}` |
| R | 7 | `{"PostCommand": "change_model シュエリン騎乗位リメイク/184/1.model3.json", "Priority": 2, "Weight": 2}` |
| R | 8 | `{"PostCommand": "change_model シュポガキWフェラ/440/1.model3.json", "Priority": 2, "Weight": 2}` |
| R | 9 | `{"PostCommand": "change_model バンドナツフェラ/199/1.model3.json", "Priority": 2, "Weight": 2}` |
| R | 10 | `{"PostCommand": "change_model プラナ開脚えっち/303/1.model3.json", "Priority": 2, "Weight": 2}` |
| R | 11 | `{"PostCommand": "change_model 伊落マリー(水着)お掃除フェラ/247/1.model3.json", "Priority": 2, "Weight": 2}` |
| R | 12 | `{"PostCommand": "change_model 伊落マリー(水着)お掃除フェラ/247/1.model3.json", "Priority": 2, "Weight": 2}` |
| R | 13 | `{"PostCommand": "change_model 玉舐め指輪っか手コキ/562/1.model3.json", "Priority": 2, "Weight": 2}` |

---

## 🎭 Model: `live2d_3110750977`
* **Windows Host Path**: `C:\users\h4rdc\Documents\Github\coding-agent\VRMs\packages_live2d_multi\live2d_3110750977.zip`
Total custom entries pruned: **29**

| Group | Entry Name | Custom Properties (Special Sauce) |
| :--- | :--- | :--- |
| 控制面板 | 控制面板1 | `{"Text": "当前好感度 {$intimacy} ", "Choices": [{"Text": "切换时装", "NextMtn": "换装:换装"}, {"Text": "语音开关", "NextMtn": "其他:语音开关"}, {"Text": "闲置语音开关", "NextMtn": "闲置语音开关:闲置语音开关"}, {"Text": "登场语音开关", "NextMtn": "登场语音开关:登场语音开关"}, {"Text": "鼠标追踪开关", "NextMtn": "其他:鼠标追踪开关"}], "Priority": 9, "Intimacy": {"Min": 0, "Max": 519}}` |
| 控制面板 | 控制面板2 | `{"Text": "当前好感度 {$intimacy} ", "Choices": [{"Text": "切换时装", "NextMtn": "换装:换装"}, {"Text": "语音开关", "NextMtn": "其他:语音开关"}, {"Text": "语音列表目录", "NextMtn": "语音列表:语音列表目录"}, {"Text": "闲置语音开关", "NextMtn": "闲置语音开关:闲置语音开关"}, {"Text": "登场语音开关", "NextMtn": "登场语音开关:登场语音开关"}, {"Text": "鼠标追踪开关", "NextMtn": "其他:鼠标追踪开关"}], "Priority": 9, "Intimacy": {"Min": 520, "Max": 999}}` |
| 控制面板 | 控制面板3 | `{"Text": "当前好感度 ∞", "Choices": [{"Text": "切换时装", "NextMtn": "换装:换装"}, {"Text": "语音开关", "NextMtn": "其他:语音开关"}, {"Text": "语音列表目录", "NextMtn": "语音列表:语音列表目录"}, {"Text": "闲置语音开关", "NextMtn": "闲置语音开关:闲置语音开关"}, {"Text": "登场语音开关", "NextMtn": "登场语音开关:登场语音开关"}, {"Text": "鼠标追踪开关", "NextMtn": "其他:鼠标追踪开关"}], "Priority": 9, "Intimacy": {"Equal": 1000}}` |
| 其他 | 鼠标追踪开关 | `{"Text": "鼠标追踪开关", "Choices": [{"Text": "开启鼠标追踪", "NextMtn": "其他:开启闲置语音"}, {"Text": "关闭鼠标追踪", "NextMtn": "其他:关闭鼠标追踪"}], "TextDuration": 3000}` |
| 其他 | 开启闲置语音 | `{"Text": "已打开鼠标跟随", "Command": "mouse_tracking enable", "TextDuration": 3000}` |
| 其他 | 关闭鼠标追踪 | `{"Text": "已关闭鼠标跟随", "Command": "mouse_tracking disable", "TextDuration": 3000}` |
| 其他 | 语音开关 | `{"Text": "语音开关设置", "Choices": [{"Text": "解除静音", "NextMtn": "其他:开麦"}, {"Text": "闭麦静音", "NextMtn": "其他:闭麦"}], "TextDuration": 3000}` |
| 其他 | 开麦 | `{"Text": "解除禁言", "Command": "unmute_sound 0", "TextDuration": 3000, "VarFloats": [{"Name": "mouse", "Type": 2, "Code": "assign 0"}]}` |
| 其他 | 闭麦 | `{"Text": "禁言", "Command": "mute_sound 0", "TextDuration": 3000, "VarFloats": [{"Name": "mouse", "Type": 2, "Code": "assign 0"}]}` |
| 闲置语音开关 | 闲置语音开关 | `{"Text": "闲置语音开关", "Choices": [{"Text": "开启闲置语音", "NextMtn": "闲置语音开关:开启闲置语音"}, {"Text": "关闭闲置语音", "NextMtn": "闲置语音开关:关闭闲置语音"}], "TextDuration": 5000}` |
| 闲置语音开关 | 开启闲置语音 | `{"Command": "motions enable Tick10;start_mtn Tick10", "VarFloats": [{"Name": "闲置语音", "Type": 2, "Code": "assign 0"}]}` |
| 闲置语音开关 | 关闭闲置语音 | `{"Command": "motions disable Tick10", "VarFloats": [{"Name": "闲置语音", "Type": 2, "Code": "assign 1"}]}` |
| 登场语音开关 | 登场语音开关 | `{"Text": "闲置语音开关", "Choices": [{"Text": "开启登场语音", "NextMtn": "登场语音开关:开启登场语音"}, {"Text": "关闭登场语音", "NextMtn": "登场语音开关:关闭登场语音"}], "TextDuration": 5000}` |
| 登场语音开关 | 开启登场语音 | `{"VarFloats": [{"Name": "登场语音", "Type": 2, "Code": "assign 0"}]}` |
| 登场语音开关 | 关闭登场语音 | `{"VarFloats": [{"Name": "登场语音", "Type": 2, "Code": "assign 1"}]}` |
| 语音列表 | 语音列表目录 | `{"Text": "语音列表目录", "Choices": [{"Text": "主界面语音Ⅰ", "NextMtn": "语音列表:主界面语音Ⅰ"}, {"Text": "主界面语音ⅠⅠ", "NextMtn": "语音列表:主界面语音ⅠⅠ"}, {"Text": "战斗语音Ⅰ", "NextMtn": "语音列表:战斗语音Ⅰ"}, {"Text": "战斗语音ⅠⅠ", "NextMtn": "语音列表:战斗语音ⅠⅠ"}]}` |
| 语音列表 | 主界面语音Ⅰ | `{"Text": "主界面语音Ⅰ", "Choices": [{"Text": "初遇", "NextMtn": "Tap:初遇"}, {"Text": "箱中气候", "NextMtn": "Tap:箱中气候"}, {"Text": "致未来", "NextMtn": "Tap:致未来"}, {"Text": "孑立", "NextMtn": "Tap:孑立"}, {"Text": "帽檐与发鬓", "NextMtn": "1-3:帽檐与发鬓"}, {"Text": "袖与手", "NextMtn": "1-3:袖与手"}, {"Text": "衣着与身形", "NextMtn": "1-3:衣着与身形"}, {"Text": "嗜好", "NextMtn": "2-3:嗜好"}, {"Text": "赞赏", "NextMtn": "2-3:赞赏"}, {"Text": "亲昵", "NextMtn": "2-3:亲昵"}, {"Text": "闲谈Ⅰ", "NextMtn": "3-3:闲谈1"}, {"Text": "闲谈Ⅱ", "NextMtn": "3-3:闲谈2"}, {"Text": "独白", "NextMtn": "3-3:独白"}]}` |
| 语音列表 | 主界面语音ⅠⅠ | `{"Text": "主界面语音ⅠⅠ", "Choices": [{"Text": "问候", "NextMtn": "Start:问候"}, {"Text": "朝晨", "NextMtn": "Tick10:朝晨"}, {"Text": "信任-朝晨", "NextMtn": "Tick10:朝晨-信任"}, {"Text": "夜暮", "NextMtn": "Tick10:夜暮"}, {"Text": "信任-夜暮", "NextMtn": "Tick10:信任-夜暮"}, {"Text": "洞悉", "NextMtn": "6-5:洞悉"}, {"Text": "洞悉之底", "NextMtn": "6-5:洞悉之底"}]}` |
| 语音列表 | 战斗语音Ⅰ | `{"Text": "战斗语音Ⅰ", "Choices": [{"Text": "入队", "NextMtn": "4-6:入队"}, {"Text": "战前", "NextMtn": "4-6:战前"}, {"Text": "受敌Ⅰ", "NextMtn": "6-5:受敌1"}, {"Text": "受敌Ⅱ", "NextMtn": "6-5:受敌2"}, {"Text": "战斗胜利", "NextMtn": "6-5:战斗胜利"}]}` |
| 语音列表 | 战斗语音ⅠⅠ | `{"Text": "战斗语音ⅠⅠ", "Choices": [{"Text": "择选咒语Ⅰ", "NextMtn": "4-6:择选咒语1"}, {"Text": "择选咒语Ⅱ", "NextMtn": "4-6:择选咒语2"}, {"Text": "择选高阶咒语", "NextMtn": "4-6:择选高阶咒语"}, {"Text": "择选至终的仪式", "NextMtn": "4-6:择选至终的仪式"}, {"Text": "释放神秘术Ⅰ", "NextMtn": "5-5:释放神秘术1-1"}, {"Text": "释放神秘术Ⅰ", "NextMtn": "5-5:释放神秘术1-2"}, {"Text": "释放神秘术Ⅱ", "NextMtn": "5-5:释放神秘术2-1"}, {"Text": "释放神秘术Ⅱ", "NextMtn": "5-5:释放神秘术2-2"}, {"Text": "召唤至终的仪式", "NextMtn": "5-5:召唤至终的仪式"}]}` |
| 好感度up | 1 | `{"Intimacy": {"Bonus": 1000}}` |
| 换装 | 换装 | `{"Text": "选择时装", "Choices": [{"Text": "初始", "NextMtn": "换装:原皮"}, {"Text": "一位质数", "NextMtn": "换装:洞悉"}, {"Text": "快乐的捕鸟人", "NextMtn": "换装:魔笛"}, {"Text": "泉眼深处", "NextMtn": "换装:泉眼"}, {"Text": "完美的流体", "NextMtn": "换装:流体"}], "Priority": 9}` |
| 换装 | 原皮 | `{"Text": "原皮", "Command": "change_cos model1.json", "Priority": 9}` |
| 换装 | 洞悉 | `{"Text": "洞悉", "Command": "change_cos model2.json", "Priority": 9}` |
| 换装 | 魔笛 | `{"Text": "魔笛", "Command": "change_cos model3.json", "Priority": 9}` |
| 换装 | 泉眼 | `{"Text": "泉眼", "Command": "change_cos model4.json", "Priority": 9}` |
| 换装 | 流体 | `{"Text": "泉眼", "Command": "change_model Motions_换装_5_Command_0.json", "Priority": 9}` |
| Start | 无语音 | `{"Command": "mouse_tracking disable", "VarFloats": [{"Name": "登场语音", "Type": 1, "Code": "equal 1"}]}` |
| 6-5 | 受敌2 | `{"Sound": "Motions_6-5_1_Sound_3.mp3", "Text": "真头疼……{$br}How troublesome ...", "Expression": "e_nanguo.exp3", "PostCommand": "clear_exp", "Priority": 3, "Interruptable": true}` |

---

## 🎭 Model: `live2d_2042115087`
* **Windows Host Path**: `C:\users\h4rdc\Documents\Github\coding-agent\VRMs\packages_live2d\live2d_2042115087.zip`
Total custom entries pruned: **1**

| Group | Entry Name | Custom Properties (Special Sauce) |
| :--- | :--- | :--- |
| Tap7 | 1 | `{"Text": "按键都为触发动画，幕布可以遮住后面，请尝试打开。乳贴可以取下。模型的头部，胸部，身体可以点击触发动画。胸部和身体可以拖拽。尝试一下连续点击身体部分吧。（左侧按钮触发动画的同时，在模型里对胸部进行拖拽也是可以的）", "Priority": 9}` |

---

## 🎭 Model: `live2d_2000010442`
* **Windows Host Path**: `C:\users\h4rdc\Documents\Github\coding-agent\VRMs\packages_live2d\live2d_2000010442.zip`
Total custom entries pruned: **19**

| Group | Entry Name | Custom Properties (Special Sauce) |
| :--- | :--- | :--- |
| 对应选项系统 | 3 | `{"text": "之后摸了个爽~", "choices": [{"text": "Next➡", "group": null, "motion": null, "next_mtn": "对应选项系统:4"}], "text_duration": 10000, "motion_duration": 10000}` |
| 对应选项系统 | 4 | `{"text": "好感度上升了！", "choices": [{"text": "去找找其他的好感度事件吧！", "group": null, "motion": null, "next_mtn": null}], "command": "motions disable 对应选项系统:4", "text_duration": 5000, "motion_duration": 5000, "intimacy": {"bonus": 30}}` |
| 对应选项系统 | 5 | `{"text": "之后讲了很多个故事，g41十分开心~", "choices": [{"text": "Next➡", "group": null, "motion": null, "next_mtn": "对应选项系统:6"}], "text_duration": 10000, "motion_duration": 10000}` |
| 对应选项系统 | 6 | `{"text": "好感度上升了！", "choices": [{"text": "去找找其他的好感度事件吧！", "group": null, "motion": null, "next_mtn": null}], "command": "motions disable 对应选项系统:6", "text_duration": 5000, "motion_duration": 5000, "intimacy": {"bonus": 30}}` |
| 对应选项系统 | 8 | `{"text": "好感度上升了！", "choices": [{"text": "去找找其他的好感度事件吧！", "group": null, "motion": null, "next_mtn": null}], "command": "motions disable 对应选项系统:8", "text_duration": 5000, "motion_duration": 5000, "intimacy": {"bonus": 30}}` |
| 对应选项系统 | 9 | `{"text": "g41害羞的跑开了！是不是好感度还不够呢~", "choices": [{"text": "去找找其他的好感度事件吧！", "group": null, "motion": null, "next_mtn": null}], "text_duration": 5000, "motion_duration": 5000}` |
| 对应选项系统 | 10 | `{"text": "成功誓约！现在点击身体可以触发誓约后专属动作哦！点击腿旁武器架解锁大破换装哦！", "choices": [{"text": "关闭窗口~", "group": null, "motion": null, "next_mtn": null}], "text_duration": 5000, "motion_duration": 5000}` |
| 对应选项系统 | 11 | `{"sound": "motions_对应选项系统_1_sound_0.wav", "text": "主人！我爱你！", "text_duration": 5000, "motion_duration": 5000}` |
| 对应选项系统 | 13 | `{"text": "点击腿旁弹夹可以换装（需要一定好感度）桌宠会在固定时间段自动报时提醒，且附带语音，不希望有语音的请注意音量关闭（可在软件内设置关闭桌宠音量）", "text_duration": 10000}` |
| 文本 | 1 | `{"sound": "motions_文本_0_sound_0.wav", "text": "嗯！！", "text_duration": 5000}` |
| 文本 | 2 | `{"sound": "motions_文本_1_sound_0.wav", "text": "主人~等等我啦~", "text_duration": 5000}` |
| 文本 | 4 | `{"sound": "motions_文本_3_sound_0.mp3", "text": "主人……别难过啦……晚上再说啦……", "choices": [{"text": "我会期待的哦~", "group": null, "motion": null, "next_mtn": "文本:6"}], "text_duration": 10000, "motion_duration": 10000}` |
| 文本 | 5 | `{"sound": "motions_文本_4_sound_0.wav", "text": "呜哇~讨厌啦~主人……", "choices": [{"text": "Next➡", "group": null, "motion": null, "next_mtn": "文本:6"}], "text_duration": 10000, "motion_duration": 10000}` |
| 文本 | 6 | `{"text": "G41害羞的跑开了。", "choices": [{"text": "关闭", "group": null, "motion": null, "next_mtn": null}], "text_duration": 10000}` |
| 文本 | 10 | `{"command": "change_cos model1.json"}` |
| 誓约 | 1 | `{"text": "指挥官要和我誓约吗？呜哇，好害羞……", "choices": [{"text": "Next➡", "group": null, "motion": null, "next_mtn": "对应选项系统:9"}], "intimacy": {"min": 0, "max": 89}}` |
| 判定 | + | `{"sound": "motions_判定_1_sound_0.mp3", "text": "呜~主人，不行……现在还太早啦~至少……", "choices": [{"text": "到晚上就可以了嘛？是这个意思吗？", "group": null, "motion": null, "next_mtn": "文本:5"}, {"text": "好吧……", "group": null, "motion": null, "next_mtn": "文本:4"}], "text_duration": 10000, "motion_duration": 10000, "intimacy": {"min": 90, "max": 100}}` |
| 换装 | - | `{"text": "好感度还不够，先去找找好感度事件吧", "text_duration": 5600, "intimacy": {"min": 0, "max": 59}}` |
| 换装 | Entry 1 | `{"text": "是否要切换为-大破", "choices": [{"text": "是", "group": null, "motion": null, "next_mtn": "文本:10"}, {"text": "算了（关闭窗口）", "group": null, "motion": null, "next_mtn": null}], "intimacy": {"min": 59, "max": 100}}` |

---

## 🎭 Model: `live2d_2108430225`
* **Windows Host Path**: `C:\users\h4rdc\Documents\Github\coding-agent\VRMs\packages_live2d\live2d_2108430225.zip`
Total custom entries pruned: **11**

| Group | Entry Name | Custom Properties (Special Sauce) |
| :--- | :--- | :--- |
| start | Entry 0 | `{"command": "start_mtn tap:startbt"}` |
| 换装 | Entry 0 | `{"text": "服装", "choices": [{"text": "未成熟的摩亞", "next_mtn": "cos1"}, {"text": "魔方摩亞", "next_mtn": "cos2"}, {"text": "大魔方摩亞", "next_mtn": "cos3"}, {"text": "忧郁的摩亞", "next_mtn": "cos4"}, {"text": "紫色的摩亞", "next_mtn": "cos5"}, {"text": "温泉", "next_mtn": "cos6"}, {"text": "双面的摩亞", "next_mtn": "cos7"}, {"text": "黑白的摩亞", "next_mtn": "cos8"}, {"text": "温泉", "next_mtn": "cos9"}]}` |
| cos1 | Entry 0 | `{"command": "change_cos model1.json"}` |
| cos2 | Entry 0 | `{"command": "change_cos model0.json"}` |
| cos3 | Entry 0 | `{"command": "change_cos model2.json"}` |
| cos4 | Entry 0 | `{"command": "change_cos model3.json"}` |
| cos5 | Entry 0 | `{"command": "change_cos model4.json"}` |
| cos6 | Entry 0 | `{"command": "change_cos model5.json"}` |
| cos7 | Entry 0 | `{"command": "change_cos model6.json"}` |
| cos8 | Entry 0 | `{"command": "change_cos model7.json"}` |
| cos9 | Entry 0 | `{"command": "change_cos model8.json"}` |

---

## 🎭 Model: `live2d_1985484220`
* **Windows Host Path**: `C:\users\h4rdc\Documents\Github\coding-agent\VRMs\packages_live2d\live2d_1985484220.zip`
Total custom entries pruned: **114**

| Group | Entry Name | Custom Properties (Special Sauce) |
| :--- | :--- | :--- |
| start | Entry 0 | `{"command": "start_mtn 语音:问候"}` |
| 誓约 | Entry 0 | `{"command": "start_mtn 语音:誓约", "intimacy": {"min": 100, "max": 100}, "var_floats": [{"name": "誓约", "type": 0, "equal": 0.0, "assign": 1.0}]}` |
| 表情 | Entry 0 | `{"command": "parameters unlock;\r\n\t\tparameters lock PARAM_EYE_L_OPEN 1.5;\r\n\t\tparameters lock PARAM_EYE_R_OPEN 1.5;\r\n\t\tparameters lock PARAM_BROW_L_FORM 1;\r\n\t\tparameters lock PARAM_BROW_R_FORM 1;\r\n\t\tparameters lock PARAM_MOUTH_FORM 0;\r\n\t\tparameters lock PARAM_MOUTH_OPEN_Y 0.1;\t\t\r\n\t\t", "var_floats": [{"name": "表情", "type": 0, "equal": 0.0, "assign": 1.0}]}` |
| 表情 | Entry 1 | `{"command": "parameters unlock;\r\n\t\tparameters lock PARAM_EYE_R_OPEN 0;\r\n\t\tparameters lock PARAM_MOUTH_FORM 1;\r\n\t\tparameters lock PARAM_MOUTH_OPEN_Y -1;\t\r\n\t\tparameters lock PARAM_CHEEK 1;\t\r\n\t\t", "var_floats": [{"name": "表情", "type": 0, "equal": 1.0, "assign": 2.0}]}` |
| 表情 | Entry 2 | `{"command": "parameters unlock;\r\n\t\tparameters lock PARAM_MOUTH_FORM -1;\r\n\t\tparameters lock PARAM_MOUTH_OPEN_Y 1;\t\r\n\t\t", "var_floats": [{"name": "表情", "type": 0, "equal": 2.0, "assign": 3.0}]}` |
| 表情 | Entry 3 | `{"command": "parameters unlock;\r\n\t\tparameters lock PARAM_EYE_L_OPEN 0;\r\n\t\tparameters lock PARAM_EYE_R_OPEN 0;\r\n\t\tparameters lock PARAM_MOUTH_FORM 0;\r\n\t\tparameters lock PARAM_MOUTH_OPEN_Y 0;\t\r\n\t\t", "var_floats": [{"name": "表情", "type": 0, "equal": 3.0, "assign": 4.0}]}` |
| 表情 | Entry 4 | `{"command": "parameters unlock", "var_floats": [{"name": "表情", "type": 0, "equal": 4.0, "assign": 0.0}]}` |
| 设定 | Entry 0 | `{"text": "设定", "choices": [{"text": "换装", "next_mtn": "换装"}, {"text": "大破", "next_mtn": "大破"}, {"text": "待机语音", "next_mtn": "待机语音开关"}, {"text": "台词鉴赏", "next_mtn": "台词鉴赏"}]}` |
| 换装 | Entry 0 | `{"text": "服装", "choices": [{"text": "PA-15", "next_mtn": "换装1"}, {"text": "高校心跳物语", "next_mtn": "换装2"}, {"text": "翠雀媚", "next_mtn": "换装3"}, {"text": "奇妙山药饼", "next_mtn": "换装4"}, {"text": "Q版", "next_mtn": "Q版"}]}` |
| 换装1 | Entry 0 | `{"command": "change_cos model1.json"}` |
| 换装2 | Entry 0 | `{"command": "change_cos model0.json"}` |
| 换装3 | Entry 0 | `{"command": "change_cos model2.json"}` |
| 换装4 | Entry 0 | `{"command": "change_cos model3.json"}` |
| Q版 | Entry 0 | `{"text": "Q版", "choices": [{"text": "PA-15：宿舍", "next_mtn": "Q版换装1"}, {"text": "PA-15：战斗", "next_mtn": "Q版换装2"}, {"text": "高校心跳物语：宿舍", "next_mtn": "Q版换装3"}, {"text": "高校心跳物语：战斗", "next_mtn": "Q版换装4"}, {"text": "翠雀媚：宿舍", "next_mtn": "Q版换装5"}, {"text": "翠雀媚：战斗", "next_mtn": "Q版换装6"}, {"text": "奇妙山药饼：宿舍", "next_mtn": "Q版换装7"}, {"text": "奇妙山药饼：战斗", "next_mtn": "Q版换装8"}]}` |
| Q版换装1 | Entry 0 | `{"command": "change_cos model4.json"}` |
| Q版换装2 | Entry 0 | `{"command": "change_cos model5.json"}` |
| Q版换装3 | Entry 0 | `{"command": "change_cos model6.json"}` |
| Q版换装4 | Entry 0 | `{"command": "change_cos model7.json"}` |
| Q版换装5 | Entry 0 | `{"command": "change_cos model8.json"}` |
| Q版换装6 | Entry 0 | `{"command": "change_cos model9.json"}` |
| Q版换装7 | Entry 0 | `{"command": "change_cos model10.json"}` |
| Q版换装8 | Entry 0 | `{"command": "change_cos model11.json"}` |
| 大破 | Entry 0 | `{"command": "change_cos model13.json", "intimacy": {"min": 100, "max": 100}}` |
| 满好感 | Entry 0 | `{"intimacy": {"min": 0, "max": 100}, "var_floats": [{"name": "满好感", "type": 0, "lower": 10.0, "add": 1.0}]}` |
| 满好感 | Entry 1 | `{"intimacy": {"min": 0, "max": 100, "bonus": 100}, "var_floats": [{"name": "满好感", "type": 0, "equal": 10.0}]}` |
| 台词鉴赏 | Entry 0 | `{"text": "台词鉴赏", "choices": [{"text": "默认语音", "next_mtn": "默认语音"}, {"text": "战斗语音", "next_mtn": "战斗语音"}, {"text": "节日语音", "next_mtn": "节日语音"}], "intimacy": {"min": 100, "max": 100}}` |
| 默认语音 | Entry 0 | `{"text": "默认语音", "choices": [{"text": "游戏标题", "next_mtn": "语音:游戏标题"}, {"text": "问候", "next_mtn": "语音:问候"}, {"text": "自我介绍", "next_mtn": "语音:自我介绍"}, {"text": "交流1", "next_mtn": "语音:交流1"}, {"text": "交流2", "next_mtn": "语音:交流2"}, {"text": "交流3", "next_mtn": "语音:交流3"}, {"text": "交流4_誓约后", "next_mtn": "语音:交流4_誓约后"}, {"text": "誓约", "next_mtn": "语音:誓约"}, {"text": "建造完成", "next_mtn": "语音:建造完成"}, {"text": "强化完成", "next_mtn": "语音:强化完成"}, {"text": "编制扩大", "next_mtn": "语音:编制扩大"}, {"text": "后勤出发", "next_mtn": "语音:后勤出发"}, {"text": "后勤归来", "next_mtn": "语音:后勤归来"}, {"text": "自律作战", "next_mtn": "语音:自律作战"}, {"text": "口癖", "next_mtn": "语音:口癖"}, {"text": "笑", "next_mtn": "语音:笑"}, {"text": "惊", "next_mtn": "语音:惊"}, {"text": "失意", "next_mtn": "语音:失意"}, {"text": "赞赏", "next_mtn": "语音:赞赏"}, {"text": "附和", "next_mtn": "语音:附和"}, {"text": "同意", "next_mtn": "语音:同意"}, {"text": "共鸣", "next_mtn": "语音:共鸣"}, {"text": "提示", "next_mtn": "语音:提示"}, {"text": "载入", "next_mtn": "语音:载入"}]}` |
| 战斗语音 | Entry 0 | `{"text": "战斗语音", "choices": [{"text": "部队编入", "next_mtn": "语音:部队编入"}, {"text": "出击", "next_mtn": "语音:出击"}, {"text": "遇敌", "next_mtn": "语音:遇敌"}, {"text": "进攻阵型", "next_mtn": "语音:进攻阵型"}, {"text": "防御阵型", "next_mtn": "语音:防御阵型"}, {"text": "技能1", "next_mtn": "语音:技能1"}, {"text": "技能2", "next_mtn": "语音:技能2"}, {"text": "技能3", "next_mtn": "语音:技能3"}, {"text": "重创", "next_mtn": "语音:重创"}, {"text": "撤退", "next_mtn": "语音:撤退"}, {"text": "胜利", "next_mtn": "语音:胜利"}, {"text": "修复", "next_mtn": "语音:修复"}]}` |
| 节日语音 | Entry 0 | `{"text": "节日语音", "choices": [{"text": "万圣节", "next_mtn": "语音:万圣节"}, {"text": "圣诞节", "next_mtn": "语音:圣诞节"}, {"text": "新年", "next_mtn": "语音:新年"}, {"text": "情人节", "next_mtn": "语音:情人节"}, {"text": "七夕", "next_mtn": "语音:七夕"}]}` |
| 待机语音开关 | Entry 0 | `{"text": "待机语音：开", "var_floats": [{"name": "待机语音", "type": 0, "equal": 1.0, "assign": 0.0}]}` |
| 待机语音开关 | Entry 1 | `{"text": "待机语音：关", "var_floats": [{"name": "待机语音", "type": 0, "equal": 0.0, "assign": 1.0}]}` |
| leave_60_60_90 | Entry 0 | `{"command": "start_mtn 待机语音", "var_floats": [{"name": "待机语音", "type": 0, "equal": 0.0}]}` |
| 待机语音 | Entry 0 | `{"command": "start_mtn 语音:问候"}` |
| 待机语音 | Entry 1 | `{"command": "start_mtn 语音:交流3"}` |
| 待机语音 | Entry 2 | `{"command": "start_mtn 语音:建造完成"}` |
| 待机语音 | Entry 3 | `{"command": "start_mtn 语音:后勤出发"}` |
| 待机语音 | Entry 4 | `{"command": "start_mtn 语音:后勤归来"}` |
| 待机语音 | Entry 5 | `{"command": "start_mtn 语音:自律作战"}` |
| 待机语音 | Entry 6 | `{"command": "start_mtn 语音:口癖"}` |
| shake | Entry 0 | `{"command": "start_mtn 语音:交流1"}` |
| shake | Entry 1 | `{"command": "start_mtn 语音:交流2"}` |
| shake | Entry 2 | `{"command": "start_mtn 语音:口癖"}` |
| shake | Entry 3 | `{"command": "start_mtn 语音:笑"}` |
| 耳 | Entry 0 | `{"command": "start_mtn 语音:笑", "intimacy": {"min": 0, "max": 100, "bonus": 1}}` |
| tap | Entry 0 | `{"command": "start_mtn 语音:游戏标题", "intimacy": {"min": 0, "max": 100, "bonus": 1}}` |
| tap | Entry 1 | `{"command": "start_mtn 语音:问候", "intimacy": {"min": 0, "max": 100, "bonus": 1}}` |
| tap | Entry 2 | `{"command": "start_mtn 语音:自我介绍", "intimacy": {"min": 0, "max": 100, "bonus": 1}}` |
| tap | Entry 3 | `{"command": "start_mtn 语音:交流1", "intimacy": {"min": 0, "max": 100, "bonus": 1}}` |
| tap | Entry 4 | `{"command": "start_mtn 语音:交流2", "intimacy": {"min": 0, "max": 100, "bonus": 1}}` |
| tap | Entry 5 | `{"command": "start_mtn 语音:交流3", "intimacy": {"min": 0, "max": 100, "bonus": 1}}` |
| tap | Entry 6 | `{"command": "start_mtn 语音:交流4_誓约后", "intimacy": {"min": 100, "max": 100}}` |
| tap | Entry 7 | `{"command": "start_mtn 语音:誓约", "intimacy": {"min": 100, "max": 100}}` |
| tap | Entry 8 | `{"command": "start_mtn 语音:建造完成", "intimacy": {"min": 0, "max": 100, "bonus": 1}}` |
| tap | Entry 9 | `{"command": "start_mtn 语音:强化完成", "intimacy": {"min": 0, "max": 100, "bonus": 1}}` |
| tap | Entry 10 | `{"command": "start_mtn 语音:编制扩大", "intimacy": {"min": 0, "max": 100, "bonus": 1}}` |
| tap | Entry 11 | `{"command": "start_mtn 语音:后勤出发", "intimacy": {"min": 0, "max": 100, "bonus": 1}}` |
| tap | Entry 12 | `{"command": "start_mtn 语音:后勤归来", "intimacy": {"min": 0, "max": 100, "bonus": 1}}` |
| tap | Entry 13 | `{"command": "start_mtn 语音:自律作战", "intimacy": {"min": 0, "max": 100, "bonus": 1}}` |
| tap | Entry 14 | `{"command": "start_mtn 语音:口癖", "intimacy": {"min": 0, "max": 100, "bonus": 1}}` |
| tap | Entry 15 | `{"command": "start_mtn 语音:笑", "intimacy": {"min": 0, "max": 100, "bonus": 1}}` |
| tap | Entry 16 | `{"command": "start_mtn 语音:惊", "intimacy": {"min": 0, "max": 100, "bonus": 1}}` |
| tap | Entry 17 | `{"command": "start_mtn 语音:失意", "intimacy": {"min": 0, "max": 100, "bonus": 1}}` |
| tap | Entry 18 | `{"command": "start_mtn 语音:赞赏", "intimacy": {"min": 0, "max": 100, "bonus": 1}}` |
| tap | Entry 19 | `{"command": "start_mtn 语音:附和", "intimacy": {"min": 0, "max": 100, "bonus": 1}}` |
| tap | Entry 20 | `{"command": "start_mtn 语音:同意", "intimacy": {"min": 0, "max": 100, "bonus": 1}}` |
| tap | Entry 21 | `{"command": "start_mtn 语音:共鸣", "intimacy": {"min": 0, "max": 100, "bonus": 1}}` |
| tap | Entry 22 | `{"command": "start_mtn 语音:提示", "intimacy": {"min": 0, "max": 100, "bonus": 1}}` |
| tap | Entry 23 | `{"command": "start_mtn 语音:载入", "intimacy": {"min": 0, "max": 100, "bonus": 1}}` |
| tap | Entry 24 | `{"command": "start_mtn 语音:万圣节", "intimacy": {"min": 100, "max": 100}}` |
| tap | Entry 25 | `{"command": "start_mtn 语音:圣诞节", "intimacy": {"min": 100, "max": 100}}` |
| tap | Entry 26 | `{"command": "start_mtn 语音:新年", "intimacy": {"min": 100, "max": 100}}` |
| tap | Entry 27 | `{"command": "start_mtn 语音:情人节", "intimacy": {"min": 100, "max": 100}}` |
| tap | Entry 28 | `{"command": "start_mtn 语音:七夕", "intimacy": {"min": 100, "max": 100}}` |
| 语音模板 | Entry 0 | `{"command": "start_mtn 语音:游戏标题"}` |
| 语音模板 | Entry 1 | `{"command": "start_mtn 语音:问候"}` |
| 语音模板 | Entry 2 | `{"command": "start_mtn 语音:自我介绍"}` |
| 语音模板 | Entry 3 | `{"command": "start_mtn 语音:交流1"}` |
| 语音模板 | Entry 4 | `{"command": "start_mtn 语音:交流2"}` |
| 语音模板 | Entry 5 | `{"command": "start_mtn 语音:交流3"}` |
| 语音模板 | Entry 6 | `{"command": "start_mtn 语音:交流4_誓约后"}` |
| 语音模板 | Entry 7 | `{"command": "start_mtn 语音:誓约"}` |
| 语音模板 | Entry 8 | `{"command": "start_mtn 语音:建造完成"}` |
| 语音模板 | Entry 9 | `{"command": "start_mtn 语音:强化完成"}` |
| 语音模板 | Entry 10 | `{"command": "start_mtn 语音:编制扩大"}` |
| 语音模板 | Entry 11 | `{"command": "start_mtn 语音:后勤出发"}` |
| 语音模板 | Entry 12 | `{"command": "start_mtn 语音:后勤归来"}` |
| 语音模板 | Entry 13 | `{"command": "start_mtn 语音:自律作战"}` |
| 语音模板 | Entry 14 | `{"command": "start_mtn 语音:口癖"}` |
| 语音模板 | Entry 15 | `{"command": "start_mtn 语音:笑"}` |
| 语音模板 | Entry 16 | `{"command": "start_mtn 语音:惊"}` |
| 语音模板 | Entry 17 | `{"command": "start_mtn 语音:失意"}` |
| 语音模板 | Entry 18 | `{"command": "start_mtn 语音:赞赏"}` |
| 语音模板 | Entry 19 | `{"command": "start_mtn 语音:附和"}` |
| 语音模板 | Entry 20 | `{"command": "start_mtn 语音:同意"}` |
| 语音模板 | Entry 21 | `{"command": "start_mtn 语音:共鸣"}` |
| 语音模板 | Entry 22 | `{"command": "start_mtn 语音:提示"}` |
| 语音模板 | Entry 23 | `{"command": "start_mtn 语音:载入"}` |
| 语音模板 | Entry 24 | `{"command": "start_mtn 语音:部队编入"}` |
| 语音模板 | Entry 25 | `{"command": "start_mtn 语音:出击"}` |
| 语音模板 | Entry 26 | `{"command": "start_mtn 语音:遇敌"}` |
| 语音模板 | Entry 27 | `{"command": "start_mtn 语音:进攻阵型"}` |
| 语音模板 | Entry 28 | `{"command": "start_mtn 语音:防御阵型"}` |
| 语音模板 | Entry 29 | `{"command": "start_mtn 语音:技能1"}` |
| 语音模板 | Entry 30 | `{"command": "start_mtn 语音:技能2"}` |
| 语音模板 | Entry 31 | `{"command": "start_mtn 语音:技能3"}` |
| 语音模板 | Entry 32 | `{"command": "start_mtn 语音:重创"}` |
| 语音模板 | Entry 33 | `{"command": "start_mtn 语音:撤退"}` |
| 语音模板 | Entry 34 | `{"command": "start_mtn 语音:胜利"}` |
| 语音模板 | Entry 35 | `{"command": "start_mtn 语音:修复"}` |
| 语音模板 | Entry 36 | `{"command": "start_mtn 语音:万圣节"}` |
| 语音模板 | Entry 37 | `{"command": "start_mtn 语音:圣诞节"}` |
| 语音模板 | Entry 38 | `{"command": "start_mtn 语音:新年"}` |
| 语音模板 | Entry 39 | `{"command": "start_mtn 语音:情人节"}` |
| 语音模板 | Entry 40 | `{"command": "start_mtn 语音:七夕"}` |

---

## 🎭 Model: `live2d_2588209550`
* **Windows Host Path**: `C:\users\h4rdc\Documents\Github\coding-agent\VRMs\packages_live2d\live2d_2588209550.zip`
Total custom entries pruned: **2**

| Group | Entry Name | Custom Properties (Special Sauce) |
| :--- | :--- | :--- |
| 鼠标 | 1 | `{"command": "mouse_tracking disable"}` |
| 鼠标 | 2 | `{"command": "mouse_tracking enable"}` |

---

## 🎭 Model: `live2d_3490176232` (Parameter-Based Texture & State Toggling)
* **Windows Host Path**: `C:\users\h4rdc\Documents\Github\coding-agent\VRMs\packages_live2d\live2d_3490176232.zip`
Total custom controllers found: **1** (`ParamValue`)

Unlike standard DSL commands (`change_cos` or `VarFloats`) placed inside motion files, this model injects a custom `ParamValue` block directly into the `Controllers` section of the `model3.json`.

**The Rendering Issue (Disappearing Bodies):**
Creators use this pattern to draw every single outfit or color variation into the same file, binding their **opacity** (PartOpacity) to Live2D Parameters (e.g., `ParamHairColor`, `ParamLegSwitch`). If the renderer fails to clamp and maintain these parameters at a valid value (e.g., exactly `1.0`), Live2D's physics or fallback engine drops the parameter to `0.0`. This instantly drops the opacity of the body meshes to 0%, making the character (or body parts) turn invisible.

To fix this natively without losing outfit switching capabilities, the Stateful Reactive Store must detect `ParamValue` bindings upon model load and continuously clamp these parameters every frame in the Delta Ticking Engine so they are not overridden by physics resets.

| Controller | Custom Properties (Special Sauce) |
| :--- | :--- |
| `ParamValue` | `{"Items": [{"Name": "MomokaSono", "Ids": ["ParamMomokaSono"], "Value": 0.5, "KeyValues": [...]}, {"Name": "LegSwitch", "Ids": ["ParamLegSwitch"], "KeyValues": [...]}, {"Name": "BedColor", "Ids": ["ParamBedColor"], "KeyValues": [...]}, {"Name": "HairColor", "Ids": ["ParamHairColor"], "KeyValues": [...]}, {"Name": "BedSwitch", "Ids": ["ParamBackground"], "KeyValues": [...]}, {"Name": "HairOrnmt", "Ids": ["ParamHairornamentSwitch"], "KeyValues": [...]}, {"Name": "HairSwitch", "Ids": ["ParamHairSwitch"], "KeyValues": [...]}, {"Name": "CheekSwitch", "Ids": ["ParamCheek"], "KeyValues": [...]}, {"Name": "PhoneSwitch", "Ids": ["ParamPhoneSwitch"], "KeyValues": [...]}, {"Name": "BedColor2", "Ids": ["ParamBedS"], "KeyValues": [...]}, {"Name": "PillowColor2", "Ids": ["ParamPillowS"], "KeyValues": [...]}], "Enabled": true}` |

## Relevant Skills

- [[airi-live2d-dsl-interpreter]]
