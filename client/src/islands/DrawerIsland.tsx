import { useEffect, useRef, useState } from 'preact/hooks';

export function DrawerIsland() {
  const [isOpen, setIsOpen] = useState(false);
  const [showAttribution, setShowAttribution] = useState(false);
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
        if (showAttribution) {
          setShowAttribution(false);
        } else {
          setIsOpen(false);
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showAttribution]);

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
          <a className="drawer-link" href="/journey" onClick={closeDrawer}>Journey</a>
          <a className="drawer-link" href="/map" onClick={closeDrawer}>Map</a>
          <a className="drawer-link" href="/party" onClick={closeDrawer}>Fellowships</a>
          <button className="drawer-link drawer-profile" type="button" onClick={handleProfileClick}>Profile</button>
        </nav>
        <div className="drawer-footer">
          <button
            type="button"
            className="drawer-attribution-link"
            onClick={() => setShowAttribution(true)}
          >
            Icon Attribution
          </button>
        </div>
      </aside>
      {showAttribution && (
        <div className="attribution-overlay" onClick={() => setShowAttribution(false)}>
          <div className="attribution-dialog" role="dialog" aria-label="Icon Attribution" onClick={(e) => e.stopPropagation()}>
            <h3>Icon Attribution</h3>
            <p>
              <a href="https://icons8.com/icon/20169/one-ring" target="_blank" rel="noopener noreferrer">One Ring</a> icon
              by <a href="https://icons8.com" target="_blank" rel="noopener noreferrer">Icons8</a>
            </p>
            <p className="attribution-usage">Used as the current position marker on the Middle-earth map.</p>
            <button type="button" className="attribution-close" onClick={() => setShowAttribution(false)}>Close</button>
          </div>
        </div>
      )}
    </>
  );
}
