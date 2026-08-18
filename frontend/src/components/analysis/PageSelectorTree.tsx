import React from 'react';
import { PageListItemDto, WebsiteDto } from '../../types/api.js';
import { Checkbox } from '../ui/Checkbox.js';
import { Globe, FileText } from 'lucide-react';

interface WebsiteTreeItem {
  website: WebsiteDto;
  pages: PageListItemDto[];
}

interface PageSelectorTreeProps {
  tree: WebsiteTreeItem[];
  selectedPageIds: string[];
  onTogglePage: (pageId: string) => void;
  onToggleWebsite: (websiteId: string, selectAll: boolean) => void;
}

export const PageSelectorTree: React.FC<PageSelectorTreeProps> = ({
  tree,
  selectedPageIds,
  onTogglePage,
  onToggleWebsite
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {tree.map(({ website, pages }) => {
        const websitePageIds = pages.map((p) => p.pageId);
        const selectedWebsitePageCount = websitePageIds.filter((id) =>
          selectedPageIds.includes(id)
        ).length;
        const allSelected = pages.length > 0 && selectedWebsitePageCount === pages.length;

        const totalFindings = pages.reduce((sum, p) => sum + (p.findingCount || 0), 0);

        return (
          <div
            key={website.websiteId}
            style={{
              border: '1px solid #E4E4E7',
              borderRadius: '10px',
              backgroundColor: '#FFFFFF',
              overflow: 'hidden',
              boxShadow: 'var(--shadow-subtle)'
            }}
          >
            {/* Website Header with subtle background grid */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.875rem 1.25rem',
                backgroundColor: '#F8FAFC',
                borderBottom: '1px solid #E2E8F0',
                position: 'relative'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', position: 'relative', zIndex: 1 }}>
                <Checkbox
                  checked={allSelected}
                  onChange={() => onToggleWebsite(website.websiteId, !allSelected)}
                />
                <Globe size={16} color="#4F46E5" />
                <span style={{ fontWeight: 600, fontSize: '0.9375rem', color: '#09090B' }}>
                  {website.origin}
                </span>
              </div>
              <div style={{ fontSize: '0.8125rem', color: '#64748B', fontWeight: 500 }}>
                {pages.length} {pages.length === 1 ? 'page' : 'pages'} · {totalFindings}{' '}
                {totalFindings === 1 ? 'finding' : 'findings'}
              </div>
            </div>

            {/* Pages List */}
            <div style={{ padding: '0.375rem 1.25rem' }}>
              {pages.map((page) => {
                const isSelected = selectedPageIds.includes(page.pageId);
                const findingsCount = page.findingCount || 0;

                return (
                  <div
                    key={page.pageId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.75rem 0',
                      borderBottom: '1px solid #F4F4F5'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <Checkbox
                        checked={isSelected}
                        onChange={() => onTogglePage(page.pageId)}
                      />
                      <FileText size={15} color="#A1A1AA" />
                      <div>
                        <div style={{ fontSize: '0.875rem', fontWeight: 500, color: '#09090B' }}>
                          {page.title || page.url}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#71717A', fontFamily: 'var(--font-mono)' }}>
                          {page.url}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {findingsCount > 0 ? (
                        <span
                          style={{
                            fontSize: '0.6875rem',
                            backgroundColor: '#FFFBEB',
                            color: '#92400E',
                            border: '1px solid #FDE68A',
                            padding: '0.2rem 0.5rem',
                            borderRadius: '4px',
                            fontWeight: 600
                          }}
                        >
                          {findingsCount} findings
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: '#A1A1AA' }}>
                          0 findings
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};
