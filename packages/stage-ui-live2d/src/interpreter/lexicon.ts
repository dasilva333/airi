/**
 * Static dictionary of universal Live2D creator idioms.
 * Extracted from analysis of 4,816 wild Live2D creator models (Wallpaper Engine, Bilibili, game rips).
 * Provides 0-latency, 0-network-call translation for ~80% of switches, mesh parts, and choices.
 */

export const LIVE2D_COMMON_LEXICON: Readonly<Record<string, string>> = {
  // --- Mesh & Outfit Controls ---
  '去布料': 'Remove Fabric / Stripped',
  '布料': 'Fabric / Clothes',
  '背景隐藏': 'Hide Background',
  '背景大小': 'Background Size',
  '背景': 'Background',
  '衣服': 'Clothes / Outfit',
  '换装': 'Change Outfit',
  '外套': 'Coat / Jacket',
  '脱外套': 'Remove Coat',
  '穿外套': 'Wear Coat',
  '裙子': 'Skirt',
  '脱裙子': 'Remove Skirt',
  '安全裤': 'Safety Shorts',
  '胖次': 'Underwear',
  '泳装': 'Swimsuit',
  '校服': 'School Uniform',
  '女仆': 'Maid Outfit',
  '睡衣': 'Sleepwear / Pajamas',
  '兔女郎': 'Bunny Girl',
  '黑丝': 'Black Stockings',
  '白丝': 'White Stockings',
  '袜子': 'Socks',
  '脱鞋': 'Remove Shoes',
  '鞋子': 'Shoes',
  '裸足': 'Barefoot',

  // --- Accessories & Parts ---
  '眼镜': 'Glasses',
  '墨镜': 'Sunglasses',
  '摘眼镜': 'Remove Glasses',
  '戴眼镜': 'Wear Glasses',
  '兽耳': 'Animal Ears',
  '猫耳': 'Cat Ears',
  '兔耳': 'Rabbit Ears',
  '狐狸耳': 'Fox Ears',
  '尾巴': 'Tail',
  '发饰': 'Hair Ornament',
  '帽子': 'Hat',
  '口罩': 'Mask',
  '项圈': 'Choker / Collar',
  '翅膀': 'Wings',
  '武器': 'Weapon',
  '无枪版本': 'Gunless Version',
  '光环': 'Halo',
  '角': 'Horns',

  // --- Actions & Stances ---
  '待机': 'Idle Stance',
  '待机动作': 'Idle Motion',
  '触摸': 'Touch Interaction',
  '重置': 'Reset Stance',
  '点击': 'Click / Tap',
  '双击': 'Double Click',
  '拖拽': 'Drag',
  '害羞': 'Blush / Shy',
  '生气': 'Angry',
  '微笑': 'Smile',
  '哭泣': 'Cry',
  '眨眼': 'Blink',
  '脸红': 'Cheek Blush',
  '流汗': 'Sweat',
  '黑化': 'Dark / Menacing',

  // --- Toggles & State Machines ---
  '开启': 'Enable',
  '关闭': 'Disable',
  '开关': 'Switch / Toggle',
  '开启登录动画': 'Enable Login Animation',
  '关闭登录动画': 'Disable Login Animation',
  '开启誓约动画': 'Enable Oath Animation',
  '关闭誓约动画': 'Disable Oath Animation',
  '鼠标跟踪': 'Mouse Tracking',
  '视线跟踪': 'Eye Tracking',
  '呼吸': 'Breathing',
  '物理': 'Physics',
  '闲聊开关': 'Chat Switch',
  '送礼菜单': 'Gift Menu',
  '纹理菜单': 'Texture Menu',

  // --- Choices & Dialogues ---
  '好的': 'Okay',
  '不用了': 'No need',
  '是': 'Yes',
  '否': 'No',
  '是！': 'Yes!',
  '当然！': 'Of course!',
  '必须的！': 'Definitely!',
  '算了': 'Nevermind',
  '算了（关闭窗口）': 'Nevermind (Close)',
  '确定': 'Confirm',
  '取消': 'Cancel',
  '晚安': 'Good night',
  '早安': 'Good morning',
  '你好': 'Hello',
  '猜拳': 'Rock Paper Scissors',
  '石头': 'Rock',
  '剪刀': 'Scissors',
  '布': 'Paper',
  '平局': 'Draw / Tie',
  '你赢了': 'You Win!',
  '你输了': 'You Lose!',
  '阿夸赢了': 'Aqua Wins!',
  '阿夸输了': 'Aqua Loses!',
  '是否打阿库娅？': 'Hit Aqua?',
  '是否再来一把？': 'Play another round?',
  '要让大狸狸先回去么？': 'Should Big Raccoon go back first?',
  '要让大狸狸出来么？': 'Should Big Raccoon come out?',
}

/**
 * Resolves a text string against the common lexicon.
 * Returns the translated label if matched, or undefined if no lexicon match exists.
 */
export function lookupLexicon(rawText: string | undefined | null): string | undefined {
  if (!rawText)
    return undefined
  const trimmed = rawText.trim()
  return LIVE2D_COMMON_LEXICON[trimmed]
}
