import { Search, Filter, RefreshCw } from 'lucide-react';

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
}

export function Header({
  searchQuery,
  onSearchChange,
  onRefresh,
  isRefreshing,
}: HeaderProps) {
  return (
    <header className="main-search-header">
      <div className="search-pill-container">
        <div className="search-input-wrapper">
          <Search size={16} className="search-icon-left" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search"
            className="header-search-input"
          />
        </div>

        <div className="header-actions-right">
          <button
            type="button"
            className="header-tool-btn"
            title="Filter emails"
          >
            <Filter size={15} />
          </button>
          <button
            type="button"
            onClick={onRefresh}
            className="header-tool-btn"
            title="Refresh list"
            disabled={isRefreshing}
          >
            <RefreshCw
              size={15}
              className={isRefreshing ? 'spin-animation' : ''}
            />
          </button>
        </div>
      </div>
    </header>
  );
}
