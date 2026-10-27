type IconName =
  | 'dashboard'
  | 'grid'
  | 'users'
  | 'book'
  | 'building'
  | 'chart'
  | 'settings'
  | 'search'
  | 'plus'
  | 'chevron-down'
  | 'chevron-left'
  | 'chevron-right'
  | 'more'
  | 'edit'
  | 'trash'
  | 'close'
  | 'clock'
  | 'calendar'
  | 'check'
  | 'warning'
  | 'info'
  | 'download'
  | 'filter'
  | 'menu'
  | 'arrow-right'
  | 'logout'
  | 'user'
  | 'shield'
  | 'star'
  | 'sun'
  | 'snow'
  | 'clock-check'
  | 'list'
  | 'play'
  | 'replay'
  | 'skip'
  | 'torch'
  | 'arrow-left'
  | 'grip'

const paths: Record<IconName, string> = {
  dashboard: 'M3 10.5 12 3l9 7.5M5 9.5V21h14V9.5M9.5 21v-6h5v6',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  users: 'M16 20v-1.6a3.4 3.4 0 0 0-3.4-3.4H7.4A3.4 3.4 0 0 0 4 18.4V20M10 11.5a3.75 3.75 0 1 0 0-7.5 3.75 3.75 0 0 0 0 7.5M20 20v-1.6a3.4 3.4 0 0 0-2.6-3.3M15.5 4.2a3.75 3.75 0 0 1 0 7.1',
  book: 'M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15.5H6.5A2.5 2.5 0 0 0 4 21zM4 18.5V5.5M8 7.5h8M8 11h5',
  building: 'M4 21V5.5L12 3l8 2.5V21M4 21h16M9 21v-5h6v5M8 8.5h1.5M14.5 8.5H16M8 12.5h1.5M14.5 12.5H16',
  chart: 'M4 20h16M7 20v-6M12 20V7M17 20v-9',
  settings: 'M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 1.56V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.56-1H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6 1.7 1.7 0 0 0 10 3.04V3a2 2 0 1 1 4 0v.09A1.7 1.7 0 0 0 15 4.6a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9c.13.6.6 1.06 1.2 1.15H21a2 2 0 1 1 0 4h-.09A1.7 1.7 0 0 0 19.4 15Z',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM20 20l-4-4',
  plus: 'M12 5v14M5 12h14',
  'chevron-down': 'M6 9l6 6 6-6',
  'chevron-left': 'M15 18l-6-6 6-6',
  'chevron-right': 'M9 18l6-6-6-6',
  more: 'M12 6.2h.01M12 12h.01M12 17.8h.01',
  edit: 'M4 20h4l10.5-10.5a2.12 2.12 0 0 0-3-3L5 17v3ZM13.5 7.5l3 3',
  trash: 'M4 7h16M9 7V4.5h6V7M6.5 7l.8 12.5A1.5 1.5 0 0 0 8.8 21h6.4a1.5 1.5 0 0 0 1.5-1.5L17.5 7M10 11v6M14 11v6',
  close: 'M6 6l12 12M18 6 6 18',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7.5V12l3 1.8',
  calendar: 'M4.5 6.5h15v14h-15zM8 3.5v5M16 3.5v5M4.5 10.5h15M8 14h2M14 14h2M8 17h2',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  warning: 'M12 3.5 2.8 20h18.4L12 3.5ZM12 9.5v4.5M12 17h.01',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 11v5M12 7.7h.01',
  download: 'M12 4v11M7.5 10.5 12 15l4.5-4.5M4.5 20h15',
  filter: 'M4 6h16M7 12h10M10 18h4',
  menu: 'M4 7h16M4 12h16M4 17h16',
  'arrow-right': 'M5 12h14M13 6l6 6-6 6',
  logout: 'M15 5h3.5A1.5 1.5 0 0 1 20 6.5v11a1.5 1.5 0 0 1-1.5 1.5H15M10 8l-4 4 4 4M6 12h9',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.5 21a7.5 7.5 0 0 1 15 0',
  shield: 'M12 3l7 3v5.5c0 4.4-3 8-7 9.5-4-1.5-7-5.1-7-9.5V6zM9.5 12l1.8 1.8L15 10',
  star: 'M12 3.6l2.5 5.1 5.6.8-4 3.9 1 5.6-5.1-2.7-5.1 2.7 1-5.6-4-3.9 5.6-.8z',
  sun: 'M12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9ZM12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4',
  snow: 'M12 2.5v19M3.8 7.2l16.4 9.6M20.2 7.2 3.8 16.8M9.2 4.4 12 7l2.8-2.6M9.2 19.6 12 17l2.8 2.6',
  'clock-check': 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7.5V12l2.5 1.5M16 18l1.8 1.8L21 16.5',
  list: 'M8 6.5h12M8 12h12M8 17.5h12M4 6.5h.01M4 12h.01M4 17.5h.01',
  play: 'M8 5.5l11 6.5-11 6.5z',
  replay: 'M4 12a8 8 0 1 0 2.6-5.9M4 4.5V10h5.5',
  skip: 'M5 5.5l9 6.5-9 6.5zM18 5.5v13',
  torch: 'M10 3h4l-.6 4.5h-2.8zM9.2 7.5h5.6l1.2 4.5H8zM10.6 12v8.5h2.8V12',
  'arrow-left': 'M19 12H5M11 6l-6 6 6 6',
  grip: 'M9 6h.01M9 12h.01M9 18h.01M15 6h.01M15 12h.01M15 18h.01',
}



interface IconProps {
  name: IconName
  size?: number
  className?: string
  strokeWidth?: number
}

export function Icon({ name, size = 16, className, strokeWidth = 1.7 }: IconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={paths[name]} />
    </svg>
  )
}

export type { IconName }
