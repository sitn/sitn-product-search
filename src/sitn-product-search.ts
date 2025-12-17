import cssText from "./styles.css?inline";

interface Product {
  label: string;
  metadata: string;
}

interface ApiResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: Product[];
}

class SitnProductSearch extends HTMLElement {
  private shadow: ShadowRoot;
  private products: Product[] = [];
  private loading: boolean = false;
  private nextPage: string | null = null;
  private observer: IntersectionObserver | null = null;
  private abortController: AbortController | null = null;
  private debounceTimer: number | null = null;

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: "open" });
  }

  connectedCallback() {
    this.render();
    this.setupEventListeners();
    this.fetchProducts();
  }

  disconnectedCallback() {
    if (this.observer) {
      this.observer.disconnect();
    }
  }

  private setupEventListeners() {
    const input = this.shadow.querySelector(".search-input") as HTMLInputElement;
    const clearBtn = this.shadow.querySelector(".clear-button") as HTMLButtonElement;

    if (input) {
      input.addEventListener("input", (e) => {
        const value = (e.target as HTMLInputElement).value;
        this.handleSearch(value);
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener("click", () => {
        if (input) {
          input.value = "";
          this.handleSearch("");
        }
      });
    }
  }

  private handleSearch(term: string) {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = window.setTimeout(() => {
      this.products = [];
      this.nextPage = null;
      this.fetchProducts(term);
    }, 300);
  }

  private async fetchProducts(term: string = "") {
    if (this.abortController) {
      this.abortController.abort();
    }
    this.abortController = new AbortController();

    this.loading = true;
    this.updateLoadingState();

    try {
      let url = "https://sitn.ne.ch/geoshop2_api/product/";
      if (term) {
        url += `?search=${encodeURIComponent(term)}`;
      }

      const response = await fetch(url, {
        signal: this.abortController.signal,
      });

      if (!response.ok) throw new Error("Network response was not ok");

      const data: ApiResponse = await response.json();
      this.products = data.results;
      this.nextPage = data.next;
      
      this.loading = false;
      this.updateList();
    } catch (error: any) {
      if (error.name === "AbortError") return;
      console.error("Error fetching products:", error);
      this.loading = false;
      this.updateList();
    }
  }

  private async fetchMoreProducts() {
    if (!this.nextPage || this.loading) return;

    this.loading = true;
    this.updateLoadingState();

    try {
      const response = await fetch(this.nextPage);
      if (!response.ok) throw new Error("Network response was not ok");

      const data: ApiResponse = await response.json();
      this.products = [...this.products, ...data.results];
      this.nextPage = data.next;
      
      this.loading = false;
      this.updateList();
    } catch (error) {
      console.error("Error fetching more products:", error);
      this.loading = false;
      this.updateList();
    }
  }

  private updateLoadingState() {
    const listContainer = this.shadow.querySelector(".suggestions-dropdown");
    if (!listContainer) return;
    
    // Check if loading indicator already exists
    let loadingEl = listContainer.querySelector(".loading");
    
    if (this.loading) {
      if (!loadingEl) {
        loadingEl = document.createElement("div");
        loadingEl.className = "loading";
        loadingEl.textContent = "Chargement...";
        listContainer.appendChild(loadingEl);
      }
    } else {
      if (loadingEl) {
        loadingEl.remove();
      }
    }
  }

  private updateList() {
    const listContainer = this.shadow.querySelector(".suggestions-dropdown");
    const input = this.shadow.querySelector(".search-input");
    if (!listContainer || !input) return;

    // Clear existing list content but keep loading indicator if it exists (though updateLoadingState handles it)
    // Actually, it's easier to rebuild the list content
    listContainer.innerHTML = "";

    if (this.products.length > 0) {
      input.classList.add("suggested");
      this.products.forEach((product, index) => {
        const item = document.createElement("div");
        item.className = "suggestion-item";
        if (index % 2 === 1) {
          item.classList.add("even");
        }
        item.onclick = () => window.open(`${product.metadata}/html/`, "_blank");
        
        const link = document.createElement("a");
        link.href = `${product.metadata}/html/`;
        link.target = "_blank";
        link.textContent = product.label;
        link.style.textDecoration = "underline";
        link.style.color = "#007c64";
        
        item.appendChild(link);
        listContainer.appendChild(item);
      });

      // Add sentinel for infinite scroll if there is a next page
      if (this.nextPage) {
        const sentinel = document.createElement("div");
        sentinel.className = "sentinel";
        sentinel.style.height = "1px";
        listContainer.appendChild(sentinel);
        this.setupIntersectionObserver(sentinel);
      }
    } else if (!this.loading) {
      // No results
      input.classList.add("suggested");
      const noResults = document.createElement("div");
      noResults.className = "no-results";
      noResults.textContent = "Aucun résultat trouvé";
      listContainer.appendChild(noResults);
    }
    
    // Re-add loading if still loading (unlikely here as updateList is called after loading=false usually)
    if (this.loading) {
      const loadingEl = document.createElement("div");
      loadingEl.className = "loading";
      loadingEl.textContent = "Chargement...";
      listContainer.appendChild(loadingEl);
    }
  }

  private setupIntersectionObserver(target: Element) {
    if (this.observer) {
      this.observer.disconnect();
    }

    this.observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && this.nextPage && !this.loading) {
          this.fetchMoreProducts();
        }
      },
      {
        root: this.shadow.querySelector(".suggestions-dropdown"),
        threshold: 0.1,
      }
    );

    this.observer.observe(target);
  }

  private render() {
    this.shadow.innerHTML = `
      <style>${cssText}</style>
      <div class="search-container">
        <div class="search-wrapper">
          <input 
            type="text" 
            class="search-input" 
            placeholder="Rechercher un produit..." 
            aria-label="Rechercher"
          />
          <button class="clear-button" aria-label="Effacer la recherche">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div class="suggestions-dropdown">
          <!-- Results will be populated here -->
          <div class="loading">Chargement...</div>
        </div>
      </div>
    `;
  }
}

customElements.define("sitn-product-search", SitnProductSearch);
