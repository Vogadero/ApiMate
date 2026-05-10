import React from 'react';
import {
  Plus,
  Send,
  FolderOpen,
  Folder,
  Play,
  Delete,
  Earth,
  Close,
  Search,
  Copy,
  Edit,
  Refresh,
  Setting,
  History,
  Download,
  Upload,
  CheckOne,
  Right,
  Down,
  Save,
  Minus,
  AddTwo,
  FolderClose,
  More,
  Lightning,
  LinkOne,
  Code,
  CodeBrackets,
  TextWrapOverflow,
  TextWrapTruncation,
  Api,
  DocDetail,
  Timer,
  PreviewOpen,
  SwitchButton,
  FolderFocus,
  FileCollection,
  IndentLeft,
  IndentRight,
  PlayTwo,
  PlusCross,
  Lock,
  Unlock,
  User,
  Key,
  Shield,
  Server,
  CloudStorage as Cloud,
  FullScreen,
  Keyboard,
  Star,
  FileCode,
  Cook,
  ToTop,
  Pushpin,
  Info,
  Help,
} from '@icon-park/svg';

export type IconName = keyof typeof iconMap;

type IconGenerator = (props: Record<string, unknown>) => string;

const iconMap: Record<string, IconGenerator> = {
  plus: Plus as IconGenerator,
  send: Send as IconGenerator,
  'folder-open': FolderOpen as IconGenerator,
  folder: Folder as IconGenerator,
  play: Play as IconGenerator,
  delete: Delete as IconGenerator,
  earth: Earth as IconGenerator,
  close: Close as IconGenerator,
  search: Search as IconGenerator,
  copy: Copy as IconGenerator,
  edit: Edit as IconGenerator,
  refresh: Refresh as IconGenerator,
  setting: Setting as IconGenerator,
  history: History as IconGenerator,
  download: Download as IconGenerator,
  upload: Upload as IconGenerator,
  check: CheckOne as IconGenerator,
  'arrow-right': Right as IconGenerator,
  'arrow-down': Down as IconGenerator,
  save: Save as IconGenerator,
  minus: Minus as IconGenerator,
  'add-circle': AddTwo as IconGenerator,
  'folder-close': FolderClose as IconGenerator,
  more: More as IconGenerator,
  lightning: Lightning as IconGenerator,
  link: LinkOne as IconGenerator,
  code: Code as IconGenerator,
  'code-brackets': CodeBrackets as IconGenerator,
  'wrap-on': TextWrapOverflow as IconGenerator,
  'wrap-off': TextWrapTruncation as IconGenerator,
  api: Api as IconGenerator,
  doc: DocDetail as IconGenerator,
  timer: Timer as IconGenerator,
  'file-size': Timer as IconGenerator,
  preview: PreviewOpen as IconGenerator,
  switch: SwitchButton as IconGenerator,
  'delete-bin': Delete as IconGenerator,
  'folder-focus': FolderFocus as IconGenerator,
  collection: FileCollection as IconGenerator,
  'indent-left': IndentLeft as IconGenerator,
  'indent-right': IndentRight as IconGenerator,
  'play-two': PlayTwo as IconGenerator,
  'plus-cross': PlusCross as IconGenerator,
  lock: Lock as IconGenerator,
  unlock: Unlock as IconGenerator,
  user: User as IconGenerator,
  key: Key as IconGenerator,
  shield: Shield as IconGenerator,
  server: Server as IconGenerator,
  cloud: Cloud as IconGenerator,
  'full-screen': FullScreen as IconGenerator,
  keyboard: Keyboard as IconGenerator,
  star: Star as IconGenerator,
  'file-code': FileCode as IconGenerator,
  cookie: Cook as IconGenerator,
  'to-top': ToTop as IconGenerator,
  pushpin: Pushpin as IconGenerator,
  info: Info as IconGenerator,
  help: Help as IconGenerator,
};

interface IconProps {
  name: string;
  size?: number;
  color?: string;
  className?: string;
  style?: React.CSSProperties;
}

export const Icon: React.FC<IconProps> = ({ name, size = 18, color = 'currentColor', className, style }) => {
  const generator = iconMap[name];
  if (!generator) return null;
  const svgStr = generator({
    width: size,
    height: size,
    fill: color,
    strokeWidth: 3,
  } as Record<string, unknown>);
  return (
    <span
      className={`iconpark-icon ${className ?? ''}`}
      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, flexShrink: 0, ...style }}
      dangerouslySetInnerHTML={{ __html: svgStr }}
    />
  );
};
