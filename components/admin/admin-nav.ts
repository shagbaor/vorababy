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
  href: string
  navIcon: typeof Home07Icon
  actionIcon?: typeof Home07Icon
}

export const adminSections: AdminSection[] = [
  { label: 'Home', href: '/admin', navIcon: Home07Icon },
  { label: 'Order', href: '/admin/orders', navIcon: Invoice01Icon, actionIcon: Invoice01Icon },
  { label: 'Dispute', href: '/admin/disputes', navIcon: Briefcase04Icon, actionIcon: Briefcase03Icon },
  { label: 'Users', href: '/admin/users', navIcon: UserIcon, actionIcon: UserIcon },
  { label: 'Support', href: '/admin/support', navIcon: CustomerSupportIcon, actionIcon: CustomerService01Icon },
]

export function isSectionActive(href: string, pathname: string) {
  return href === '/admin' ? pathname === href : pathname === href || pathname.startsWith(`${href}/`)
}
