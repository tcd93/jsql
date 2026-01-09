import { useState } from "react";
import { useTabStore } from "../../../store/tabStore";
import styles from "./QueryTab.module.css";
import ResultsTable from "./Table/ResultsTable";
import TableToolbar from "./Toolbar/TableToolbar";

const QueryTab = ({ tabId }: { tabId: string }): React.JSX.Element => {
  const [searchText, setSearchText] = useState("");
  const error = useTabStore((state) => state.getTab(tabId)?.error);
  const isCancelled = useTabStore((state) => state.getTab(tabId)?.isCancelled);
  const schema = useTabStore((state) => state.getTab(tabId)?.schema);

  return (
    <>
      {error ? (
        <div className={styles.errorMessage}>{error}</div>
      ) : isCancelled ? (
        <div className={styles.errorMessage}>Query was cancelled</div>
      ) : (
        <>
          {schema && schema.length > 0 && (
            <TableToolbar
              searchText={searchText}
              setSearchText={setSearchText}
              tabId={tabId}
              schema={schema}
            />
          )}
          <ResultsTable
            searchText={searchText}
            tabId={tabId}
          />
        </>
      )}
    </>
  );
};

export default QueryTab;
