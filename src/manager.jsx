// src/manager.jsx
import { render } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import tippy from 'tippy.js';
import 'tippy.js/dist/tippy.css';
import 'tippy.js/themes/light-border.css';

// Set default Tippy options
tippy.setDefaultProps({
  delay: [100, 0],
  duration: [200, 150],
  theme: 'light-border',
  placement: 'top',
});

// Bookmark Item Component
function BookmarkItem({ bookmark, onDelete, onEdit }) {
  const editButtonRef = useRef(null);

  const handleDeleteClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onDelete(bookmark);
  };

  return (
    <div className="bookmark-item">
      <a 
        href={bookmark.url} 
        target='_blank'
        className="bookmark-link" 
      >
        <img src={bookmark.favicon} className="favicon" alt="" />
        {bookmark.title}
      </a>
      <div className="bookmark-actions">
        <button
          ref={editButtonRef}
          onClick={() => onEdit(bookmark, editButtonRef.current)}
          className="btn-edit"
        >
          {bookmark.tags?.length > 0 && (
            <span className="">
              {bookmark.tags.slice(0, 2).map(tag => (
                <span key={tag} className="tag-badge">{tag}</span>
              ))}
              {bookmark.tags.length > 2 && (
                <span className="tag-more">+{bookmark.tags.length - 2}</span>
              )}
            </span>
          ) || (<span className=""><span className="tag-badge">-</span></span>)}
        </button>
          <span className="close-btn" onClick={handleDeleteClick}>
            <svg width="9" height="9" viewBox="0 0 14 14" fill="currentColor">
              <path d="M13 1L1 13M1 1l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>
            </svg>
          </span>        
      </div>
    </div>
  );
}

// Tag Picker Component with Tippy
function TagPicker({ bookmark, tags, onSelectTag, onCreateTag, onClose, triggerElement }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [instance, setInstance] = useState(null);
  const [contentElement, setContentElement] = useState(null);

  // Common function to set up event listeners
  const setupEventListeners = (content, tippyInstance) => {
    const input = content.querySelector('input');
    const tagItems = content.querySelectorAll('.tag-picker-item');
    const doneBtn = content.querySelector('.done-btn');

    const handleInput = (e) => {
      setSearchQuery(e.target.value);
    };

    const handleTagClick = (item) => {
      if (item.dataset.create) {
        onCreateTag(bookmark, searchQuery.trim());
        tippyInstance.hide();
      } else {
        onSelectTag(bookmark, item.dataset.tag);
        tippyInstance.hide();
      }
    };

    const handleDone = () => {
      tippyInstance.hide();
    };

    input?.addEventListener('input', handleInput);
    
    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        tippyInstance.hide();
      }
    });

    tagItems.forEach(item => {
      item.addEventListener('click', () => handleTagClick(item));
    });

    doneBtn?.addEventListener('click', handleDone);

    return input;
  };

  // Common function to render content
  const renderContent = (preserveInputFocus = false) => {
    if (!contentElement) return null;

    const filteredTags = tags.filter(tag => 
      tag.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Store current selection and focus state
    const currentInput = contentElement.querySelector('input');
    const selectionStart = currentInput?.selectionStart;
    const selectionEnd = currentInput?.selectionEnd;
    const hadFocus = document.activeElement === currentInput;

    contentElement.innerHTML = `
      <h3>Edit tags for: ${bookmark.title}</h3>
      <input
        type="text"
        placeholder="Search or create tag..."
        value="${searchQuery}"
        autofocus
      />
      <div class="tag-picker-list">
        ${filteredTags.map(tag => `
          <button
            class="tag-picker-item ${bookmark.tags?.includes(tag) ? 'selected' : ''}"
            data-tag="${tag}"
          >
            ${tag}
            ${bookmark.tags?.includes(tag) ? ' ✓' : ''}
          </button>
        `).join('')}
        ${searchQuery && !tags.includes(searchQuery) ? `
          <button class="tag-picker-item create" data-create="true">
            + Create "${searchQuery}"
          </button>
        ` : ''}
      </div>
      <div class="tag-picker-actions">
        <button class="done-btn">Done</button>
      </div>
    `;

    const input = setupEventListeners(contentElement, instance);

    // Restore focus and cursor position if needed
    if (preserveInputFocus && hadFocus && input) {
      input.focus();
      if (selectionStart !== null && selectionEnd !== null) {
        input.setSelectionRange(selectionStart, selectionEnd);
      }
    }

    return input;
  };

  useEffect(() => {
    if (!triggerElement || instance) return;

    const content = document.createElement('div');
    content.className = 'tag-picker';
    setContentElement(content);

    // Initial render
    renderContent();

    const newInstance = tippy(triggerElement, {
      content: content,
      trigger: 'manual',
      interactive: true,
      placement: 'bottom-start',
      theme: 'light-border',
      arrow: false,
      duration: [200, 150],
      appendTo: document.body,
      onShow() {
        // Focus input when shown
        setTimeout(() => {
          const input = content.querySelector('input');
          if (input) input.focus();
        }, 100);
      },
      onHide() {
        onClose();
        setInstance(null);
        setContentElement(null);
      }
    });

    setInstance(newInstance);
    newInstance.show();

    return () => {
      if (newInstance) {
        newInstance.destroy();
      }
    };
  }, [triggerElement]);

  // Update content when searchQuery or other dependencies change
  useEffect(() => {
    if (instance && contentElement) {
      renderContent(true);
    }
  }, [searchQuery, tags, bookmark, instance, onSelectTag, onCreateTag]);

  return null;
}

// Main App Component
function App() {
  const [state, setState] = useState({
    bookmarks: [],
    filteredBookmarks: [],
    tags: [],
    selectedTag: null,
    searchQuery: '',
    loading: true,
    showUndo: false,
    deletedBookmark: null,
    showTagPicker: false,
    bookmarkForTagging: null,
    tagPickerTrigger: null
  });

  // Add a ref to store the timeout ID
  const undoTimeoutRef = useRef(null);

  // Load bookmarks and organize tags
  useEffect(() => {
    loadBookmarks();
  }, []);

  // Filter bookmarks when search or tag selection changes
  useEffect(() => {
    // Only filter if we have bookmarks loaded
    if (state.bookmarks.length === 0) return;
    
    let filtered = state.bookmarks;
    
    if (state.selectedTag) {
      filtered = filtered.filter(bookmark => 
        bookmark.tags?.includes(state.selectedTag)
      );
    }
    
    if (state.searchQuery) {
      const query = state.searchQuery.toLowerCase();
      filtered = filtered.filter(bookmark =>
        bookmark.title.toLowerCase().includes(query) ||
        bookmark.url.toLowerCase().includes(query) ||
        bookmark.tags?.some(tag => tag.toLowerCase().includes(query))
      );
    }
    
    setState(prev => ({ ...prev, filteredBookmarks: filtered }));
  }, [state.bookmarks, state.selectedTag, state.searchQuery]);

  async function loadBookmarks() {
    try {
      const chromeBookmarks = await new Promise(resolve => {
        chrome.bookmarks.getTree(resolve);
      });
      
      const allBookmarks = [];
      const tagSet = new Set();
      
      function processNode(node, currentPath = [], parentId = '1') {
        if (node.url) {
          // It's a bookmark
          const bookmarkTags = currentPath.filter(path => 
            path && !/Bookmarks/i.test(path) && path.indexOf('Imported') == -1
          );
          allBookmarks.push({
            id: node.id,
            title: node.title || 'Untitled',
            url: node.url,
            dateAdded: node.dateAdded,
            parentId: node.parentId, // Store the parentId
            tags: bookmarkTags,
            favicon: `https://www.google.com/s2/favicons?domain=${new URL(node.url).hostname}&sz=16`
          });
          
          // Add tags to tag set
          bookmarkTags.forEach(tag => tagSet.add(tag));
        } else if (node.children) {
          // It's a folder (tag)
          const newPath = [...currentPath, node.title];
          node.children.forEach(child => processNode(child, newPath, node.id));
        }
      }
      
      processNode(chromeBookmarks[0]);
      
      // Count bookmarks per tag
      const tagCounts = {};
      allBookmarks.forEach(bookmark => {
        bookmark.tags?.forEach(tag => {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        });
      });
      
      // Convert tag set to array and sort by count (descending), then alphabetically
      const sortedTags = Array.from(tagSet).sort((a, b) => {
        const countA = tagCounts[a] || 0;
        const countB = tagCounts[b] || 0;
        
        // Sort by count descending first
        if (countB !== countA) {
          return countB - countA;
        }
        
        // If counts are equal, sort alphabetically
        return a.localeCompare(b);
      });
      
      const sortedBookmarks = allBookmarks.sort((a, b) => b.dateAdded - a.dateAdded);
      
      // Single state update with all data, including initial filtered bookmarks
      setState(prev => ({
        ...prev,
        bookmarks: sortedBookmarks,
        filteredBookmarks: sortedBookmarks, // Set filtered bookmarks to all bookmarks initially
        tags: sortedTags,
        loading: false
      }));
    } catch (error) {
      console.error('Error loading bookmarks:', error);
      setState(prev => ({ ...prev, loading: false }));
    }
  }


  function handleDeleteBookmark(bookmark) {
    // Clear any existing timeout
    if (undoTimeoutRef.current) {
      clearTimeout(undoTimeoutRef.current);
      undoTimeoutRef.current = null;
    }

    // Store the complete bookmark data including parentId before deleting
    const bookmarkToDelete = {
      ...bookmark,
      originalParentId: bookmark.parentId // Store the original location
    };
    
    // Delete from Chrome immediately
    chrome.bookmarks.remove(bookmark.id);
    
    // Remove from UI state
    const newBookmarks = state.bookmarks.filter(b => b.id !== bookmark.id);
    
    setState(prev => ({
      ...prev,
      bookmarks: newBookmarks,
      filteredBookmarks: newBookmarks.filter(b => {
        if (state.selectedTag && !b.tags?.includes(state.selectedTag)) return false;
        if (state.searchQuery) {
          const query = state.searchQuery.toLowerCase();
          return b.title.toLowerCase().includes(query) ||
                 b.url.toLowerCase().includes(query) ||
                 b.tags?.some(tag => tag.toLowerCase().includes(query));
        }
        return true;
      }),
      deletedBookmark: bookmarkToDelete, // Store the complete bookmark data
      showUndo: true
    }));
    
    // Set new timeout and store its ID
    undoTimeoutRef.current = setTimeout(() => {
      setState(prev => {
        if (prev.showUndo) {
          setState(prev => ({
            ...prev,
            showUndo: false,
            deletedBookmark: null
          }));
        }
        return prev;
      });
      undoTimeoutRef.current = null;
    }, 5000);
  }

  function handleUndoDelete() {
    // Clear the timeout when undo is clicked
    if (undoTimeoutRef.current) {
      clearTimeout(undoTimeoutRef.current);
      undoTimeoutRef.current = null;
    }

    if (state.deletedBookmark) {
      // Restore to the original folder location
      const parentId = state.deletedBookmark.originalParentId || '1';
      
      chrome.bookmarks.create({
        parentId: parentId, // Use the original parentId
        title: state.deletedBookmark.title,
        url: state.deletedBookmark.url
      }, (restoredBookmark) => {
        // Update UI state with the restored bookmark
        const restoredBookmarks = [...state.bookmarks, {
          ...state.deletedBookmark,
          id: restoredBookmark.id, // Use the new ID from Chrome
          parentId: parentId // Update to the restored parentId
        }].sort((a, b) => b.dateAdded - a.dateAdded);
        
        setState(prev => ({
          ...prev,
          bookmarks: restoredBookmarks,
          filteredBookmarks: restoredBookmarks.filter(b => {
            if (state.selectedTag && !b.tags?.includes(state.selectedTag)) return false;
            if (state.searchQuery) {
              const query = state.searchQuery.toLowerCase();
              return b.title.toLowerCase().includes(query) ||
                     b.url.toLowerCase().includes(query) ||
                     b.tags?.some(tag => tag.toLowerCase().includes(query));
            }
            return true;
          }),
          showUndo: false,
          deletedBookmark: null
        }));
      });
    } else {
      setState(prev => ({ ...prev, showUndo: false }));
    }
  }

  function handleEditTags(bookmark, triggerElement) {
    setState(prev => ({
      ...prev,
      bookmarkForTagging: bookmark,
      tagPickerTrigger: triggerElement,
      showTagPicker: true
    }));
  }

  async function handleTagSelect(bookmark, tagName) {
    try {
      // Toggle tag - if bookmark has tag, remove it; if not, add it
      const hasTag = bookmark.tags?.includes(tagName);
      
      if (hasTag) {
        // Remove tag (move bookmark to root)
        await chrome.bookmarks.move(bookmark.id, { parentId: '1' });
      } else {
        // Add tag (create folder and move bookmark there)
        const folder = await chrome.bookmarks.create({
          parentId: '1',
          title: tagName
        });
        await chrome.bookmarks.move(bookmark.id, { parentId: folder.id });
      }
      
      // Reload bookmarks to reflect changes
      loadBookmarks();
    } catch (error) {
      console.error('Error updating tags:', error);
    }
  }

  async function handleCreateTag(bookmark, newTag) {
    try {
      // Create new folder and move bookmark there
      const folder = await chrome.bookmarks.create({
        parentId: '1',
        title: newTag
      });
      await chrome.bookmarks.move(bookmark.id, { parentId: folder.id });
      
      // Reload bookmarks to reflect changes
      loadBookmarks();
      setState(prev => ({ ...prev, showTagPicker: false }));
    } catch (error) {
      console.error('Error creating tag:', error);
    }
  }

  const closeTagPicker = () => {
    setState(prev => ({
      ...prev,
      showTagPicker: false,
      bookmarkForTagging: null,
      tagPickerTrigger: null
    }));
  };

  // Helper functions to update specific state properties
  const setSearchQuery = (query) => setState(prev => ({ ...prev, searchQuery: query }));
  const setSelectedTag = (tag) => setState(prev => ({ ...prev, selectedTag: tag }));

  // Add this function to handle key events
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setSearchQuery('');
    }
  };

  return (
    <div className="container">
      <header className="fixed-header">
        <h1>Bookmark Manager by <a className="aamu" href='https://aamu.app/' target='_blank'>Aamu.app</a></h1>
        <span className="count">{state.filteredBookmarks.length} bookmarks</span>
      </header>

      <div className="main-content">
        <div className="top-bar">
          <div id="search-box">
            <input
              id="search-input"
              type="text"
              placeholder="Search bookmarks by title, URL, or tags..."
              value={state.searchQuery}
              onInput={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
            />
          </div>
        </div>
        <div className="main">
          <aside className="tag-list">
            <button
              className={`tag-btn ${!state.selectedTag ? 'active' : ''}`}
              onClick={() => setSelectedTag(null)}
            >
              All Bookmarks
            </button>
            {state.tags.map(tag => (
              <button
                key={tag}
                className={`tag-btn ${state.selectedTag === tag ? 'active' : ''}`}
                onClick={() => setSelectedTag(tag)}
              >
                {tag} ({state.bookmarks.filter(b => b.tags?.includes(tag)).length})
              </button>
            ))}
          </aside>

          <section className="bookmarks-list">
            {state.loading ? (
              <div className="loading">Loading bookmarks...</div>
            ) : state.filteredBookmarks.length === 0 ? (
              <div className="no-bookmarks">
                {state.searchQuery || state.selectedTag ? 'No bookmarks match your filters' : 'No bookmarks found'}
              </div>
            ) : (
              state.filteredBookmarks.map(bookmark => (
                <BookmarkItem
                  key={bookmark.id}
                  bookmark={bookmark}
                  onDelete={handleDeleteBookmark}
                  onEdit={handleEditTags}
                />
              ))
            )}
          </section>
        </div>
      </div>

      {state.showUndo && (
        <div className="undo-toast">
          Bookmark deleted
          <button onClick={handleUndoDelete}>Undo</button>
        </div>
      )}

      {state.showTagPicker && state.bookmarkForTagging && state.tagPickerTrigger && (
        <TagPicker
          bookmark={state.bookmarkForTagging}
          tags={state.tags}
          onSelectTag={handleTagSelect}
          onCreateTag={handleCreateTag}
          onClose={closeTagPicker}
          triggerElement={state.tagPickerTrigger}
        />
      )}
    </div>
  );
}

// Render the app
render(<App />, document.body);