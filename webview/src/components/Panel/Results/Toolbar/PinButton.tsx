import React, { useRef, useCallback } from "react";
import { FaThumbtack, FaChevronDown } from "react-icons/fa";
import { useGlobalContextMenuStore } from "../../../../store/globalContextMenuStore";
import { useTabStore } from "../../../../store/tabStore";
import styles from "./PinButton.module.css";
import { PinDropdownMenu } from "./PinDropdownMenu";

interface PinButtonProps {
  currentTabId: string;
}

const PinButton: React.FC<PinButtonProps> = ({ currentTabId }) => {
  const buttonRef = useRef<HTMLButtonElement>(null);

  const tabSchema = useTabStore((state) => state.getTab(currentTabId)?.schema);

  const setContextMenu = useGlobalContextMenuStore(
    (state) => state.setContextMenu
  );
  const closeContextMenu = useGlobalContextMenuStore(
    (state) => state.closeContextMenu
  );
  const isPinDropdownOpen = useGlobalContextMenuStore((state) =>
    state.isPinDropdownOpen(currentTabId)
  );

  const toggleDropdown = useCallback(() => {
    if (isPinDropdownOpen) {
      closeContextMenu();
    } else if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setContextMenu({
        type: "pin",
        x: rect.left,
        y: rect.bottom + 4,
        tabId: currentTabId,
      });
    }
  }, [isPinDropdownOpen, closeContextMenu, setContextMenu, currentTabId]);

  const pinDropdownMenu = useGlobalContextMenuStore((state) =>
    state.contextMenu?.type === "pin" &&
    state.contextMenu.tabId === currentTabId
      ? state.contextMenu
      : null
  );

  if (!tabSchema || tabSchema.length === 0) {
    return null;
  }

  return (
    <div className={styles.container}>
      <button
        ref={buttonRef}
        className={`${styles.pinButton} ${
          isPinDropdownOpen ? styles.active : ""
        }`}
        onClick={toggleDropdown}
        title="Pin columns"
        data-pin-dropdown-toggle="true"
      >
        <FaThumbtack />
        <FaChevronDown size={10} />
      </button>

      {pinDropdownMenu && (
        <PinDropdownMenu
          x={pinDropdownMenu.x}
          y={pinDropdownMenu.y}
          tabId={pinDropdownMenu.tabId}
        />
      )}
    </div>
  );
};

export default PinButton;
