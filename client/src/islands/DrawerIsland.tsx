import { useEffect, useRef, useState } from 'preact/hooks';

export function DrawerIsland() {
  const [isOpen, setIsOpen] = useState(false);
  const drawerRef = useRef<HTMLElement | null>(null);
  const triggerButtonRef = useRef<HTMLButtonElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const prevIsOpenRef = useRef(false);

  useEffect(() => {
    document.body.classList.toggle('drawer-open', isOpen);

    return () => {
      document.body.classList.remove('drawer-open');
    };
  }, [isOpen]);

  useEffect(() => {
    const drawerElement = drawerRef.current;
    if (!drawerElement) {
      return;
    }

    const focusableItems = drawerElement.querySelectorAll('a, button');
    focusableItems.forEach((element) => {
      const isButton = element.tagName.toLowerCase() === 'button';
      if (isButton) {
        (element as HTMLButtonElement).disabled = !isOpen;
      }

      if (isOpen) {
        element.removeAttribute('tabindex');
      } else {
        element.setAttribute('tabindex', '-1');
      }
    });

    const prevIsOpen = prevIsOpenRef.current;

    // Only manage focus on transitions, not on initial mount
    if (!prevIsOpen && isOpen) {
      // Transitioning from closed to open
      drawerElement.removeAttribute('inert');
      // Move focus to the first focusable element (close button) in the drawer
      if (closeButtonRef.current) {
        closeButtonRef.current.focus();
      }
    } else if (prevIsOpen && !isOpen) {
      // Transitioning from open to closed
      drawerElement.setAttribute('inert', '');
      // Restore focus to the trigger button when closing
      if (triggerButtonRef.current) {
        triggerButtonRef.current.focus();
      }
    } else {
      // Initial mount or no transition - just set inert attribute
      if (isOpen) {
        drawerElement.removeAttribute('inert');
      } else {
        drawerElement.setAttribute('inert', '');
      }
    }

    // Update the previous state for next render
    prevIsOpenRef.current = isOpen;
  }, [isOpen]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  function openDrawer() {
    setIsOpen(true);
  }

  function closeDrawer() {
    setIsOpen(false);
  }

  function handleProfileClick(event: Event) {
    event.preventDefault();
    const profileModal = (window as typeof window & { showProfileModal?: () => void }).showProfileModal;
    if (profileModal) {
      profileModal();
    }
    closeDrawer();
  }

  return (
    <>
      <button
        type="button"
        className="menu-icon"
        aria-label={isOpen ? 'Close Navigation' : 'Open Navigation'}
        title="Menu"
        aria-expanded={isOpen ? 'true' : 'false'}
        aria-controls="navigation-drawer"
        onClick={openDrawer}
        ref={triggerButtonRef}
      >
        <i className="fas fa-bars" aria-hidden="true"></i>
      </button>
      <div className="drawer-backdrop" aria-hidden="true" onClick={closeDrawer}></div>
      <aside id="navigation-drawer" className="side-drawer" aria-hidden={isOpen ? 'false' : 'true'} ref={drawerRef}>
        <div className="drawer-header">
          <span className="drawer-title">Navigation</span>
          <button
            type="button"
            className="drawer-close"
            aria-label="Close Navigation"
            onClick={closeDrawer}
            ref={closeButtonRef}
          >
            <i className="fas fa-times" aria-hidden="true"></i>
          </button>
        </div>
        <nav className="drawer-nav">
          <a className="drawer-link" href="/" onClick={closeDrawer}>Journey</a>
          <a className="drawer-link" href="/map" onClick={closeDrawer}>Map</a>
          <button className="drawer-link drawer-profile" type="button" onClick={handleProfileClick}>Profile</button>
        </nav>
      </aside>
    </>
  );
}
