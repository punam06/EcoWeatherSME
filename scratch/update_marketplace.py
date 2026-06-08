import re

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Update CLimaLogixApp state
    state_replacement = """  const [productsList, setProductsList] = useState([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/products`);
        const json = await res.json();
        if (json.success && json.data) {
          setProductsList(json.data);
        } else {
          setProductsList([]);
        }
      } catch (err) {
        console.error("Failed to fetch products:", err);
      } finally {
        setIsLoadingProducts(false);
      }
    };
    fetchProducts();
  }, []);"""
    
    content = re.sub(r'  const \[productsList, setProductsList\] = useState\(MOCK_PRODUCTS\);', state_replacement, content)

    # 2. Update MarketplaceView signature
    content = re.sub(r'function MarketplaceView\(\{ products = (MOCK_PRODUCTS|\[\]) \}\)', 'function MarketplaceView({ products = [], isLoading = false })', content)

    # 3. Add isLoading to MarketplaceView calls
    content = re.sub(r'<MarketplaceView products=\{productsList\} />', '<MarketplaceView products={productsList} isLoading={isLoadingProducts} />', content)

    # 4. Insert Skeleton Loaders in MarketplaceView
    skeleton_html = """{isLoading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <Card key={i} style={{ padding: "20px 24px", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden", minHeight: 280 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: "var(--border-primary)", animation: "pulse 1.5s infinite" }} />
                <div style={{ flex: 1 }}>
                  <div style={{ height: 16, width: "80%", background: "var(--border-primary)", borderRadius: 4, marginBottom: 8, animation: "pulse 1.5s infinite" }} />
                  <div style={{ height: 12, width: "50%", background: "var(--border-primary)", borderRadius: 4, animation: "pulse 1.5s infinite" }} />
                </div>
              </div>
              <div style={{ marginTop: "auto" }}>
                <div style={{ height: 20, width: "40%", background: "var(--border-primary)", borderRadius: 4, marginBottom: 16, animation: "pulse 1.5s infinite" }} />
                <div style={{ height: 40, width: "100%", background: "var(--border-primary)", borderRadius: 8, animation: "pulse 1.5s infinite" }} />
              </div>
            </Card>
          ))
        ) : filteredProducts.length === 0 ? (
          <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "40px", color: "var(--text-secondary)" }}>
            No products match your criteria.
          </div>
        ) : (
          filteredProducts.map(p => {"""
    
    content = content.replace('{filteredProducts.map(p => {', skeleton_html)
    
    # 5. Add matching closing parenthesis for the conditional
    # The previous code had:
    # {filteredProducts.map(p => {
    #   ...
    #   return ( <Card ... /> );
    # })}
    # We replaced `{filteredProducts.map(p => {` with `{isLoading ? (...) : filteredProducts.length === 0 ? (...) : ( filteredProducts.map(p => {`
    # We need to find the matching `})}` and change it to `}))}`
    # To be safe, we will just replace `        })}
      </div>` with `        }))}
      </div>`
    content = content.replace('        })\n      </div>', '        }))}\n      </div>')
    content = content.replace('        })}\n      </div>', '        }))}\n      </div>')

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

process_file(r"d:\user_jabu\hackathon-ev\Frontend and UI\climalogix_dashboard.jsx")
process_file(r"d:\user_jabu\hackathon-ev\Frontend and UI\index.html")
print("Done")
