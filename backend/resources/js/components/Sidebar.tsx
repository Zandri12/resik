import ClickSpark from './ClickSpark'
import { SidebarBrand, SidebarNavLinks } from './SidebarNav'
import SidebarFooter from './SidebarFooter'

export default function Sidebar() {
  return (
    <aside className="fixed z-20 hidden h-full w-64 flex-col border-r border-outline-variant/20 bg-surface-container-low md:flex">
      <SidebarBrand />
      <nav className="mt-4 flex min-h-0 flex-1 flex-col px-2">
        <ClickSpark
          sparkColor="#005160"
          sparkSize={10}
          sparkRadius={15}
          sparkCount={8}
          duration={400}
          className="min-h-0 flex-1"
        >
          <SidebarNavLinks />
        </ClickSpark>
      </nav>
      <SidebarFooter />
    </aside>
  )
}
