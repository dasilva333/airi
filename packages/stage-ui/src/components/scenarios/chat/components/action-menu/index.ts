export type ChatActionMenuAction =
  | 'copy'
  | 'delete'
  | 'delete-following'
  | 'fork'
  | 'fork-switch'
  | 'edit'
  | 'retry'
  | 'journal'

export interface ChatActionMenuItem {
  action: ChatActionMenuAction
  label: string
  icon: string
  danger?: boolean
  divider?: boolean // Render divider after this item!
}

export function createChatActionMenuItems(options: {
  canCopy: boolean
  canDelete: boolean
  canFork?: boolean
  canEdit?: boolean
  canRetry?: boolean
}): ChatActionMenuItem[] {
  return [
    options.canCopy
      ? {
          action: 'copy',
          icon: 'i-solar:copy-bold',
          label: 'Copy',
        }
      : null,
    options.canEdit !== false
      ? {
          action: 'edit',
          divider: options.canRetry === false, // Group 1 ends if no retry
          icon: 'i-solar:pen-bold',
          label: 'Edit',
        }
      : null,
    options.canRetry !== false
      ? {
          action: 'retry',
          divider: true, // Group 1 ends
          icon: 'i-solar:restart-bold',
          label: 'Retry',
        }
      : null,
    options.canFork !== false
      ? {
          action: 'fork',
          icon: 'i-solar:layers-bold-duotone',
          label: 'Fork to Background',
        }
      : null,
    options.canFork !== false
      ? {
          action: 'fork-switch',
          icon: 'i-solar:square-forward-bold',
          label: 'Fork & Switch',
        }
      : null,
    {
      action: 'journal',
      divider: true, // Group 2 ends
      icon: 'i-solar:notebook-bold',
      label: 'Journal Moment',
    },
    options.canDelete
      ? {
          action: 'delete',
          danger: true,
          icon: 'i-solar:trash-bin-minimalistic-bold',
          label: 'Delete Message',
        }
      : null,
    options.canDelete
      ? {
          action: 'delete-following',
          danger: true,
          icon: 'i-solar:scissors-bold',
          label: 'Trim Timeline',
        }
      : null,
  ].filter(Boolean) as ChatActionMenuItem[]
}

export { default as ChatActionMenu } from './index.vue'
