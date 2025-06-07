// Prevent URL preview in status bar
document.addEventListener('mouseover', function(e) {
    if (e.target.tagName === 'A' || e.target.tagName === 'BUTTON' || e.target.getAttribute('role') === 'button') {
        window.status = '';
        return false;
    }
});

// Additional prevention for all interactive elements
document.addEventListener('mouseover', function(e) {
    if (e.target.closest('a') || e.target.closest('button') || e.target.closest('[role="button"]')) {
        window.status = '';
        return false;
    }
});

// Prevent default link behavior
document.querySelectorAll('a').forEach(link => {
    link.addEventListener('mouseover', function(e) {
        e.preventDefault();
        return false;
    });
});

// --- Search Modal Logic ---

document.addEventListener('DOMContentLoaded', async function () {
  console.log('[Search Debug] DOMContentLoaded event fired.');
  const searchToggle = document.querySelector('.search-toggle');
  console.log('[Search Debug] searchToggle element:', searchToggle);
  const searchModal = document.getElementById('searchModal');
  const closeSearch = document.querySelector('.close-search');
  const searchInput = document.getElementById('searchInput');
  const searchTags = document.getElementById('searchTags');
  const searchArticles = document.getElementById('searchArticles');
  const clearSearchInputButton = document.getElementById('clearSearchInput');

  let blogData = []; // Store article data including content
  const tagMap = {}; // Store tag counts
  let activeTags = new Set(); // Change to Set to store multiple active tags
  let lastSearchQuery = ''; // Store the last search query

  // Function to disable body scroll
  function disableBodyScroll() {
    document.body.style.overflow = 'hidden';
    document.body.style.paddingRight = '15px'; // Compensate for scrollbar width
  }

  // Function to enable body scroll
  function enableBodyScroll() {
    document.body.style.overflow = '';
    document.body.style.paddingRight = '';
  }

  // Function to fetch article content
  async function fetchArticleContent(url) {
    console.log(`[Search Debug] Attempting to fetch: ${url}`);
    try {
      const response = await fetch(url);
      if (!response.ok) {
        console.error(`[Search Debug] Failed to fetch ${url}: ${response.statusText}`);
        return null;
      }
      console.log(`[Search Debug] Successfully fetched: ${url}`);
      return await response.text();
    } catch (error) {
      console.error(`[Search Debug] Error fetching ${url}:`, error);
      return null;
    }
  }

  // Load blog data and fetch content
  async function loadBlogData() {
     console.log('[Search Debug] Starting loadBlogData');
    blogData = []; // Clear existing data
    activeTags = new Set(); // Clear active tags on reload
    searchTags.innerHTML = ''; // Clear tags UI
    searchArticles.innerHTML = ''; // Clear articles UI

    try {
      // Fetch data from JSON file
      const response = await fetch('/blog-data.json');
      if (!response.ok) {
        console.error(`[Search Debug] Failed to fetch blog-data.json: ${response.statusText}`);
        return;
      }
      const articlesList = await response.json();
      console.log('[Search Debug] Fetched articles list from JSON:', articlesList);

      for (const articleInfo of articlesList) {
        const url = articleInfo.url;
        const tags = articleInfo.tags || [];
        const title = articleInfo.title;

        const content = await fetchArticleContent(url);

        if (content) {
          // Create a temporary element to parse the HTML content
          const parser = new DOMParser();
          const doc = parser.parseFromString(content, 'text/html');

          // --- Extract and Parse Fixed TOC ----
          const fixedTocElement = doc.querySelector('.fixed-toc');
          const sections = [];
          if (fixedTocElement) {
              const links = fixedTocElement.querySelectorAll('ul li a');
              links.forEach(link => {
                  const sectionTitle = link.textContent.trim();
                  const href = link.getAttribute('href');
                  if (href && href.startsWith('#')) {
                      const sectionId = href.substring(1); // Remove the #
                      sections.push({ title: sectionTitle, id: sectionId });
                  }
              });
          }
          console.log(`[Search Debug] Extracted sections for ${title}:`, sections);
          // --- End Extract and Parse Fixed TOC ---

          // --- Aggressive Content Cleaning ---
          // Remove script, style, pre, and code elements
          doc.querySelectorAll('script, style, pre, code').forEach(el => el.remove());

          // Get the plain text content after removing specified elements
          const cleanContent = doc.body.textContent || doc.body.innerText || '';

          blogData.push({
            title,
            url,
            tags,
            content, // Store the original fetched HTML content
            plainTextContent: cleanContent, // Store the cleaned plain text content
            sections: sections // Store the extracted sections data
          });
          console.log(`[Search Debug] Added article: ${title}`);

          // Update tag counts based on loaded articles
          tags.forEach(tag => {
            if (!tagMap[tag]) tagMap[tag] = 0;
            tagMap[tag]++;
          });
        }
      }
      console.log('[Search Debug] Finished loadBlogData. blogData:', blogData);
      renderTags(); // Render tags once data is loaded
       // Perform initial search if there is a query in the input
      if (searchInput.value.trim() !== '') {
          filterArticles();
      }

    } catch (error) {
      console.error('[Search Debug] Error loading blog data:', error);
    }

  }

  function renderTags() {
    const tags = Object.keys(tagMap).sort();
    searchTags.innerHTML = '<ul>' + tags.map(tag => {
      // Calculate count based on articles where the tag is present
      const count = blogData.filter(article => article.tags.includes(tag)).length;
      const id = `tag-filter-${tag.replace(/[^a-zA-Z0-9]/g, '-')}`; // Create a valid ID
      return `
      <li class="tag-filter">
        <input type="checkbox" id="${id}" data-tag="${tag}" ${activeTags.has(tag) ? 'checked' : ''}>
        <label for="${id}">
          <span class="custom-checkbox"></span>
          <span class="tag-text">${tag}</span>
          <span class="tag-count">(${count})</span>
        </label>
      </li>
    `;
    }).join('') + '</ul>';
     console.log('[Search Debug] Tags rendered. tagMap:', tagMap);
  }

  function renderArticles(results) {
    console.log('[Search Debug] Rendering articles. Results:', results);
    if (results.length === 0) {
      searchArticles.innerHTML = ''; // Clear the articles section without showing any message
      return;
    }

    // Group results by article URL
    const groupedResults = results.reduce((acc, result) => {
      if (!acc[result.url]) {
        acc[result.url] = {
          title: result.title,
          url: result.url,
          matches: []
        };
      }
      acc[result.url].matches.push({
        section: result.section,
        sectionId: result.sectionId, // Include section ID in grouped matches
        snippet: result.snippet
      });
      return acc;
    }, {});

    searchArticles.innerHTML = Object.values(groupedResults).map(article => `
      <div class="article-result">
        <div class="article-result-title"><a href="${article.url}" tabindex="0">${article.title}</a></div>
        <div class="article-matches">
          ${article.matches.map(match => `
            <div class="article-match-item">
              <div style="display: flex; align-items: center;">
                <i class="fas fa-level-down-alt" style="font-size: 1rem; color: var(--secondary-text-color); margin-right: 8px; transform: rotate(-90deg) scaleX(-1);"></i>
                ${match.sectionId ? 
                  `<a href="${article.url}#${match.sectionId}" tabindex="0" style="color: inherit; text-decoration: none;">${match.section}</a>` 
                  : `<div class="article-result-section">${match.section}</div>` // Render as div if no section ID
                }
              </div>
              <div class="article-result-snippet">${match.snippet}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `).join('');
  }

  function extractSnippet(content, query, sectionTitle) {
    // Use a temporary element to get the plain text content of the whole article
    const fullTextTempDiv = document.createElement('div');
    fullTextTempDiv.innerHTML = content;
    const fullTextContent = fullTextTempDiv.textContent || fullTextTempDiv.innerText || '';
    const fullTextContentLower = fullTextContent.toLowerCase();

    let textToSearch = fullTextContent;
    let baseIndex = 0;

    // Attempt to find the section in the original HTML and then get its text content
    const sectionRegex = new RegExp(`(?:<h[1-6][^>]*?>\s*${sectionTitle.replace(/[-\/\\^$*+?.()|[\\]{}]/g, '\\$&')}\s*<\\/h[1-6]>)([\\s\\S]*?)`, 'i');
    const sectionMatch = sectionRegex.exec(content);

    if (sectionMatch && sectionMatch[1]) {
       // Use a temporary element to get the plain text content of the section
        const sectionTextTempDiv = document.createElement('div');
        sectionTextTempDiv.innerHTML = sectionMatch[1];
        textToSearch = sectionTextTempDiv.textContent || sectionTextTempDiv.innerText || '';

         // Find the starting index of this section's text content within the full plain text content
         baseIndex = fullTextContentLower.indexOf(textToSearch.toLowerCase());
         if(baseIndex === -1) baseIndex = 0; // Fallback if not found (shouldn't happen if logic is correct)

    } else {
         // If section not found or no content after heading, search in full plain text
         textToSearch = fullTextContent;
         baseIndex = 0;
    }

    const textToSearchLower = textToSearch.toLowerCase();
    const queryIndex = textToSearchLower.indexOf(query.toLowerCase());

    if (queryIndex !== -1) {
        const start = Math.max(0, queryIndex - 50); // Get up to 50 chars before
        const end = Math.min(textToSearch.length, queryIndex + query.length + 150); // Get up to 150 chars after
        let snippet = textToSearch.substring(start, end);

        // Simple highlighting
        const highlightRegex = new RegExp(`(${query.replace(/[-\/\\^$*+?.()|[\\]{}]/g, '\\$&')})`, 'gi');
        snippet = snippet.replace(highlightRegex, '<mark>$1</mark>');

         // Add ellipses if snippet is truncated
        if (start > 0) snippet = '...' + snippet;
        if (end < textToSearch.length) snippet = snippet + '...';

        return snippet.trim();
    }

     // Fallback: if no match found in the determined section/full text, return default
    return '...'; // Default empty snippet if no match found
  }

  function extractSnippetFromPlainText(plainText, query, matchIndex) {
      const queryLower = query.toLowerCase();
      const plainTextLower = plainText.toLowerCase();

      // Ensure matchIndex is within bounds and actually corresponds to the query
      if (matchIndex === -1 || plainTextLower.substring(matchIndex, matchIndex + queryLower.length) !== queryLower) {
          console.error('[Search Debug] Snippet extraction called with incorrect match index.', {plainText, query, matchIndex});
           return '...'; // Return a default snippet or handle error
      }

      const start = Math.max(0, matchIndex - 50); // Get up to 50 chars before
      const end = Math.min(plainText.length, matchIndex + query.length + 150); // Get up to 150 chars after
      let snippet = plainText.substring(start, end);

      // Find word boundaries for the match
      const wordStart = snippet.lastIndexOf(' ', matchIndex - start) + 1;
      const wordEnd = snippet.indexOf(' ', matchIndex - start + query.length);
      const wordEndIndex = wordEnd === -1 ? snippet.length : wordEnd;
      
      // Get the full word containing the match
      const fullWord = snippet.substring(wordStart, wordEndIndex);
      
      // Replace the full word with the highlighted version
      const highlightedWord = `<span style="color: var(--accent-color);">${fullWord}</span>`;
      snippet = snippet.substring(0, wordStart) + highlightedWord + snippet.substring(wordEndIndex);

      // Add ellipses if snippet is truncated
      if (start > 0) snippet = '...' + snippet;
      if (end < plainText.length) snippet = snippet + '...';

      return snippet.trim();
  }

  function findSectionTitle(originalHtmlContent, plainTextMatchIndex, plainTextContent) {
      // This function tries to find the section title based on the plain text index
      // and then looks up the ID in the pre-parsed sections data.
      // It no longer relies on mapping plain text index directly to HTML element ID.

      console.log('[Search Debug] findSectionTitle called for plainTextMatchIndex:', plainTextMatchIndex);

      const parser = new DOMParser();
      const doc = parser.parseFromString(originalHtmlContent, 'text/html');
      const headings = doc.querySelectorAll('h1, h2, h3, h4, h5, h6');
      let closestHeadingText = 'General'; // Default section text

      // Find the closest preceding heading text in the original HTML based on approximate position
      // We still need to find the closest heading text to look it up in our sections data.
      let htmlApproxIndex = 0;
      let plainTextApproxIndex = 0;
      const walk = document.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT, null);
      let node;
      while(node = walk.nextNode()) {
          const nodeText = node.textContent || '';
          if (plainTextApproxIndex + nodeText.length > plainTextMatchIndex) {
               // The match is in this text node or just before it.
               // Find the index of this text node in the original HTML (approximate).
               const nodeHtmlIndex = originalHtmlContent.indexOf(nodeText, htmlApproxIndex);
               if (nodeHtmlIndex !== -1) {
                   htmlApproxIndex = nodeHtmlIndex;
                   break; // Found an approximate HTML index for the match location
               }
          }
           const nodeHtmlIndex = originalHtmlContent.indexOf(nodeText, htmlApproxIndex);
           if (nodeHtmlIndex !== -1) {
               htmlApproxIndex = nodeHtmlIndex + nodeText.length;
           } else {
               htmlApproxIndex += nodeText.length; // Fallback
           }

           plainTextApproxIndex += nodeText.length;
      }
       console.log('[Search Debug] Approximated HTML index for finding closest heading text:', htmlApproxIndex);

      for(let i = headings.length - 1; i >= 0; i--) {
          const heading = headings[i];
          const headingOuterHTMLIndex = originalHtmlContent.indexOf(heading.outerHTML);
          if (headingOuterHTMLIndex === -1) continue;

          const headingEndIndex = headingOuterHTMLIndex + heading.outerHTML.length;
          if (headingEndIndex < htmlApproxIndex) {
               closestHeadingText = heading.textContent.trim();
               console.log('[Search Debug] Found closest heading text:', closestHeadingText);
               break;
          }
      }

      // Now look up the section ID in the pre-parsed sections data
      const articleData = blogData.find(article => article.content === originalHtmlContent); // Find the article data
      let sectionId = null;
      if (articleData && articleData.sections) {
          const section = articleData.sections.find(sec => sec.title === closestHeadingText);
          if (section) {
              sectionId = section.id;
          }
      }
       console.log('[Search Debug] Looked up section ID:', sectionId);

      return { title: closestHeadingText, id: sectionId }; // Return the found section title and ID
  }

  function filterArticles() {
    console.log('[Search Debug] Running filterArticles');
    const query = searchInput.value.trim().toLowerCase();
    const results = []; // Array to hold all found match objects across all articles
    const MAX_RESULTS_PER_ARTICLE = 3; // Limit results per article

    // If search box is empty and no tags are active, show no results
    if (query === '' && activeTags.size === 0) {
        console.log('[Search Debug] Empty query and no active tags, showing no results.');
        searchArticles.innerHTML = ''; // Clear the articles section
        return;
    }

    if (blogData.length === 0) {
        console.log('[Search Debug] blogData is empty, cannot filter.');
        searchArticles.innerHTML = ''; // Clear the articles section
        return;
    }

    blogData.forEach(article => {
      const matchesTags = activeTags.size === 0 || article.tags.some(tag => activeTags.has(tag));
      // Use the pre-processed clean plain text for searching
       const cleanTextContent = article.plainTextContent.toLowerCase();
       const titleLower = article.title.toLowerCase();
       const tagsLower = article.tags.join(' ').toLowerCase();

      // Check for match in title, tags, or clean plain text content
      const matchesQuery = query === '' ||
                           titleLower.includes(query) ||
                           tagsLower.includes(query) ||
                           cleanTextContent.includes(query);

      if (matchesTags && matchesQuery) {
          if (query === '') { // If no query, just add the article if tag matches (as a placeholder)
               results.push({
                   title: article.title,
                   url: article.url,
                   section: article.tags.join(', ') || 'Quickish Reads', // Show tags or default section
                   sectionId: null, // No specific section ID for title/tag matches
                   snippet: 'Available Article' // Indicate it's available
               });
          } else { // If there's a query, find specific matches in clean plain text content
               const queryRegex = new RegExp(query.replace(/[-\/\\^$*+?.()|[\\]{}]/g, '\\$&'), 'gi');
               let match;

               // Search in the clean plain text content
                const plainTextMatches = [];
                while ((match = queryRegex.exec(cleanTextContent)) !== null) { // Search in cleanTextContent
                    plainTextMatches.push({
                        textMatch: match[0],
                         plainTextIndex: match.index // Store index in plain text
                     });
                 }

               // Process each plain text match, but limit to MAX_RESULTS_PER_ARTICLE
               plainTextMatches.slice(0, MAX_RESULTS_PER_ARTICLE).forEach(plainMatch => {
                    // Find the section title and ID based on the plain text match index
                    const sectionInfo = findSectionTitle(article.content, plainMatch.plainTextIndex, article.plainTextContent);
                    console.log('[Search Debug] Section info from findSectionTitle:', sectionInfo);
                    // Only include results that have a valid sectionId
                    if (sectionInfo.id) {
                        // Extract snippet directly from the plain text content
                        const snippet = extractSnippetFromPlainText(article.plainTextContent, query, plainMatch.plainTextIndex);

                        results.push({
                            title: article.title,
                            url: article.url,
                            section: sectionInfo.title,
                            sectionId: sectionInfo.id,
                            snippet: snippet
                        });
                    }
                });

              // If no matches were found in the clean plain text content, check title and tags as a fallback
              if (plainTextMatches.length === 0 && (titleLower.includes(query) || tagsLower.includes(query))) {
                   let snippet = '';
                   let section = '';
                   if(titleLower.includes(query)) {
                       // Find the full word containing the query in the title
                       const titleWords = article.title.split(' ');
                       const highlightedTitle = titleWords.map(word => {
                           if (word.toLowerCase().includes(query)) {
                               return `<span style="color: var(--accent-color);">${word}</span>`;
                           }
                           return word;
                       }).join(' ');
                       snippet += `Matched in title: ${highlightedTitle}. `;
                        section = 'Title';
                   }
                   if(tagsLower.includes(query)) {
                       // Find the full word containing the query in the tags
                       const tagWords = article.tags.join(', ').split(' ');
                       const highlightedTags = tagWords.map(word => {
                           if (word.toLowerCase().includes(query)) {
                               return `<span style="color: var(--accent-color);">${word}</span>`;
                           }
                           return word;
                       }).join(' ');
                       snippet += `Matched in tags: ${highlightedTags}.`;
                       if(section === '') section = 'Tags'; else section += ', Tags';
                   }

                   // Only include title/tag matches if they have a valid sectionId
                   const sectionInfo = findSectionTitle(article.content, 0, article.plainTextContent);
                   if (sectionInfo.id) {
                       results.push({
                           title: article.title,
                           url: article.url,
                           section: sectionInfo.title,
                           sectionId: sectionInfo.id,
                           snippet: snippet || 'Match found in title or tags.'
                       });
                   }
               }
          }
      }
    });

     // Remove duplicate results that have the exact same URL, section, and snippet
    const uniqueResults = Array.from(new Map(results.map(item => [
        item.url + item.section + item.snippet, item])).values());

    console.log('[Search Debug] Filtered results:', uniqueResults);
    renderArticles(uniqueResults);
  }

  // Open modal
  if(searchToggle) {
    searchToggle.addEventListener('click', async () => {
      console.log('[Search Debug] Search toggle clicked');
      searchModal.style.display = 'flex';
      disableBodyScroll(); // Disable body scroll
      if (blogData.length === 0) { // Load data only if not loaded
          console.log('[Search Debug] blogData is empty, loading data.');
          searchArticles.innerHTML = '<p style="color:var(--secondary-text-color);">Loading articles...</p>';
          await loadBlogData();
      } else {
          console.log('[Search Debug] blogData already loaded.');
      }
      renderTags();
      // Restore last search query and results
      searchInput.value = lastSearchQuery;
      if (lastSearchQuery) {
          clearSearchInputButton.style.display = 'block';
      }
      filterArticles(); // Filter after data is loaded
      searchInput.focus();
    });
  } else {
      console.error('[Search Debug] Search toggle element not found!');
  }

  // Close modal
  closeSearch.addEventListener('click', () => {
    console.log('[Search Debug] Close button clicked');
    searchModal.style.display = 'none';
    enableBodyScroll(); // Enable body scroll
  });
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      console.log('[Search Debug] Escape key pressed');
      searchModal.style.display = 'none';
      enableBodyScroll(); // Enable body scroll
    }
  });

  // Tag filter click
  searchTags.addEventListener('change', e => {
     console.log('[Search Debug] Tag area change event');
    const checkbox = e.target.closest('input[type="checkbox"]');
    if (checkbox) {
      const tag = checkbox.getAttribute('data-tag');
      console.log(`[Search Debug] Checkbox changed for tag: ${tag}, checked: ${checkbox.checked}`);
      
      if (checkbox.checked) {
          activeTags.add(tag);
          checkbox.closest('li.tag-filter')?.classList.add('active');
      } else {
          activeTags.delete(tag);
          checkbox.closest('li.tag-filter')?.classList.remove('active');
      }
      
      filterArticles();
    }
  });

  // Search input
  searchInput.addEventListener('input', () => {
      lastSearchQuery = searchInput.value.trim(); // Store the current search query
      filterArticles();
      // Show/hide clear button based on input value
      if (searchInput.value.length > 0) {
          clearSearchInputButton.style.display = 'block';
      } else {
          clearSearchInputButton.style.display = 'none';
      }
  });

  // Clear search input button
  clearSearchInputButton.addEventListener('click', () => {
      searchInput.value = '';
      lastSearchQuery = ''; // Clear the stored search query
      clearSearchInputButton.style.display = 'none';
      filterArticles(); // Update results after clearing
      searchInput.focus(); // Put focus back in the search box
  });

   // Initial data load (optional, can load on modal open)
  // loadBlogData();
});

// --- Scroll to Next Section Button Logic (Mobile) ---

document.addEventListener('DOMContentLoaded', function () {
    console.log('[Scroll Button Debug] DOMContentLoaded fired.');
    const scrollButton = document.getElementById('scrollToNextSection');
    const mainContent = document.querySelector('.main-content');

    if (!scrollButton || !mainContent) {
        console.log('[Scroll Button Debug] Scroll button or main content not found, skipping logic.');
        return; // Exit if button or main content is not present
    }

    let scrolling = false; // Flag to prevent multiple scrolls

    // Function to find the next heading (h2 or h3)
    function findNextHeading() {
        const headings = mainContent.querySelectorAll('h2, h3');
        const currentScrollPosition = window.scrollY;
        const tolerance = 30; // Increased tolerance to avoid selecting the current heading

        for (let i = 0; i < headings.length; i++) {
            const headingTop = headings[i].getBoundingClientRect().top + window.scrollY;

            // Find the first heading that is sufficiently below the current scroll position.
            // This ensures we skip the current heading even if we are exactly at its top.
            if (headingTop > currentScrollPosition + tolerance) {
                return headings[i];
            }
        }
        return null; // No next heading found below current scroll position
    }

    // Function to scroll to an element with smooth behavior
    function scrollToElement(element) {
        if (element) {
            scrolling = true;
            const elementPosition = element.getBoundingClientRect().top + window.scrollY;
            // Adjust scroll position to account for fixed header/padding if necessary
            const offsetPosition = elementPosition - 20; // Example offset

            window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth'
            });

            // Use a timeout to reset scrolling flag after animation
            setTimeout(() => {
                scrolling = false;
            }, 800); // Match the smooth scroll duration approximately
        }
    }

    // Function to check if user is at the bottom of the main content
    function isAtBottomOfPage() {
        // Check if the bottom of the viewport is at or past the bottom of the main content
         // Using a small tolerance (e.g., 50px) for smoother transition
        return (window.scrollY + window.innerHeight >= mainContent.offsetTop + mainContent.offsetHeight - 50);
    }

    // Function to update button appearance and behavior
    function updateScrollButton() {
        const headings = mainContent.querySelectorAll('h2, h3');
        const lastHeading = headings.length > 0 ? headings[headings.length - 1] : null;
        const currentScrollPosition = window.scrollY;

        // Check if the user is at the bottom of the main content OR
        // if the scroll position is past the start of the last heading (with some tolerance)
        const tolerance = 50; // Tolerance in pixels
        const isScrolledPastLastHeading = lastHeading && currentScrollPosition >= lastHeading.offsetTop - tolerance;

        if (isAtBottomOfPage() || isScrolledPastLastHeading) {
            // Change to up arrow icon
            scrollButton.innerHTML = '<i class="fas fa-chevron-up"></i>';
            scrollButton.setAttribute('aria-label', 'Scroll to top');
             // Store original behavior to restore it later
             if (!scrollButton.dataset.originalBehavior) {
                 scrollButton.dataset.originalBehavior = 'next';
             }
        } else {
             // Only change back if it was previously 'to top'
            if (scrollButton.dataset.originalBehavior === 'next' || scrollButton.querySelector('i.fa-chevron-up')) {
                // Change to down arrow icon
                scrollButton.innerHTML = '<i class="fas fa-chevron-down"></i>';
                scrollButton.setAttribute('aria-label', 'Scroll to next section');
                 scrollButton.dataset.originalBehavior = ''; // Reset stored behavior
            }
        }
    }

    // Handle button click
    scrollButton.addEventListener('click', () => {
        if (scrolling) return; // Prevent scrolling while animation is in progress

        // If the button is showing the 'up' arrow icon, scroll to top
        if (scrollButton.querySelector('i.fa-chevron-up')) {
            scrolling = true;
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
             setTimeout(() => { scrolling = false; }, 800); // Reset flag
        } else {
            // Otherwise, scroll to the next section
            const nextHeading = findNextHeading();
            if (nextHeading) {
                scrollToElement(nextHeading);
            }
        }
    });

    // Update button on scroll and initial load
    window.addEventListener('scroll', updateScrollButton);
    // Use a timeout to ensure mainContent offsetHeight is calculated after layout
     setTimeout(updateScrollButton, 100);

});