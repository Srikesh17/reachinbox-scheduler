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
    <header className="main-search-header border-bottom p-3">
      <div className="search-pill-container d-flex align-items-center justify-content-between rounded-pill border px-3 bg-white">
        <div className="search-input-wrapper d-flex align-items-center gap-2 flex-grow-1">
          <i className="fa-solid fa-magnifying-glass text-muted small"></i>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search"
            className="header-search-input border-0 flex-grow-1"
          />
        </div>

        <div className="header-actions-right d-flex align-items-center gap-2">
          <button
            type="button"
            className="header-tool-btn text-muted border-0 bg-transparent p-1"
            title="Filter emails"
          >
            <i className="fa-solid fa-sliders"></i>
          </button>
          <button
            type="button"
            onClick={onRefresh}
            className="header-tool-btn text-muted border-0 bg-transparent p-1"
            title="Refresh list"
            disabled={isRefreshing}
          >
            <i
              className={`fa-solid fa-arrows-rotate ${
                isRefreshing ? 'spin-animation' : ''
              }`}
            ></i>
          </button>
        </div>
      </div>
    </header>
  );
}
