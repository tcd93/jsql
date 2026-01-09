import { useCallback, useEffect, useRef } from "react";
import { useGlobalContextMenuStore } from "../store/globalContextMenuStore";

interface MenuContextReturn {
  menuRef: React.RefObject<HTMLDivElement | null>;
}

export const useMenuContext = (): MenuContextReturn => {
  const menuRef = useRef<HTMLDivElement | null>(null);

  const closeContextMenu = useGlobalContextMenuStore(
    (state) => state.closeContextMenu
  );

  const handleKeyboardNavigation = useCallback(
    (event: KeyboardEvent): void => {
      const menuItems = Array.from(
        menuRef.current?.querySelectorAll("button:not([disabled])") ?? []
      );

      const currentIndex = menuItems.findIndex(
        (item) => item === document.activeElement
      );

      switch (event.key) {
        case "ArrowDown": {
          event.preventDefault();
          const nextIndex =
            currentIndex < menuItems.length - 1 ? currentIndex + 1 : 0;
          (menuItems[nextIndex] as HTMLButtonElement)?.focus();
          break;
        }
        case "ArrowUp": {
          event.preventDefault();
          const prevIndex =
            currentIndex > 0 ? currentIndex - 1 : menuItems.length - 1;
          (menuItems[prevIndex] as HTMLButtonElement)?.focus();
          break;
        }
        case "Home": {
          event.preventDefault();
          (menuItems[0] as HTMLButtonElement)?.focus();
          break;
        }
        case "End": {
          event.preventDefault();
          (menuItems[menuItems.length - 1] as HTMLButtonElement)?.focus();
          break;
        }
        case "Escape": {
          event.preventDefault();
          closeContextMenu();
          break;
        }
      }
    },
    [closeContextMenu]
  );

  useEffect(() => {
    const ref = menuRef.current;
    if (ref) {
      ref.addEventListener("keydown", handleKeyboardNavigation);

      // Focus the selected button if available, otherwise the first enabled button
      const selectedButton = ref.querySelector(
        'button[data-selected="true"]'
      ) as HTMLButtonElement;
      const firstButton = ref.querySelector(
        "button:not([disabled])"
      ) as HTMLButtonElement;
      (selectedButton || firstButton)?.focus();
    }

    return (): void => {
      if (ref) {
        ref.removeEventListener("keydown", handleKeyboardNavigation);
      }
    };
  }, [handleKeyboardNavigation]);

  return {
    menuRef,
  };
};
