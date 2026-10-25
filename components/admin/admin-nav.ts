import {
  Briefcase03Icon,
  Briefcase04Icon,
  CustomerService01Icon,
  CustomerSupportIcon,
  Home07Icon,
  Invoice01Icon,
  UserIcon,
} from '@hugeicons/core-free-icons'

export type AdminSection = {
  label: string
  // Only sections that have a page get an href; the rest render as disabled.
  href?: string
  navIcon: typeof Home07Icon
  actionIcon?: typeof Home07Icon
}

export const adminSections: AdminSection[] = [
  { label: 'Home', href: '/admin', navIcon: Home07Icon },
  { label: 'Order', navIcon: Invoice01Icon, actionIcon: Invoice01Icon },
  { label: 'Dispute', navIcon: Briefcase04Icon, actionIcon: Briefcase03Icon },
  { label: 'Users', navIcon: UserIcon, actionIcon: UserIcon },
  { label: 'Support', navIcon: CustomerSupportIcon, actionIcon: CustomerService01Icon },
]
