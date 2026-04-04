import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Navbar from './Navbar'
import ClickSpark from './ClickSpark'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { SidebarBrand, SidebarNavLinks } from './SidebarNav'
import SidebarFooter from './SidebarFooter'

export default function OwnerLayout() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  return (
    <div className="flex min-h-screen min-h-[100dvh] font-body text-on-surface bg-surface">
      <Sidebar />
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent
          side="left"
          showCloseButton
          className="w-full max-w-xs gap-0 border-outline-variant/20 bg-surface-container-low p-0 sm:max-w-sm"
        >
          <div className="flex max-h-[100dvh] flex-col overflow-hidden">
            <SidebarBrand />
            <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
              <ClickSpark
                sparkColor="#005160"
                sparkSize={10}
                sparkRadius={15}
                sparkCount={8}
                duration={400}
                className="min-h-0"
              >
                <SidebarNavLinks onNavigate={() => setMobileNavOpen(false)} />
              </ClickSpark>
            </nav>
            <SidebarFooter onNavigate={() => setMobileNavOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>
      <main className="pb-safe-main ml-0 flex min-h-screen min-h-[100dvh] min-w-0 flex-1 flex-col bg-surface md:ml-64">
        <Navbar onOpenMobileNav={() => setMobileNavOpen(true)} />
        <ClickSpark
          sparkColor="#005160"
          sparkSize={10}
          sparkRadius={15}
          sparkCount={8}
          duration={400}
          className="flex h-auto min-h-0 w-full min-w-0 flex-1 flex-col"
        >
          <Outlet />
        </ClickSpark>
      </main>
    </div>
  )
}
