// Fixture sample for the C++ docstring checker.

#include <vector>

namespace internal {
namespace {
int helper_count(int x) { return x; }
}
}

constexpr int kMaxSize = 10;

class GargantuanTableIterator;

enum class Color { Red, Green, Blue };

class GargantuanTable {
 public:
  /**
   * Seeks to the first entry >= key.
   * @param key The offset to seek to.
   */
  void Seek(int key);

  bool done() const;

  void Reset() override;

  GargantuanTableIterator() = delete;

 private:
  void log_lookup();
};

/// Does foo and bar.
///
/// \param Baz kind of foo to do.
/// \returns true on success.
bool fooBar(bool Baz);

/// A lookup table with reserve slots.
class Table {
 public:
  /// Constructs the table with \p reserve slots.
  explicit Table(int reserve);

  int size() const { return static_cast<int>(slots_.size()); }

 private:
  std::vector<int> slots_;
};

int operator+(const Table& a, const Table& b);

struct Config {
  int retries;
};
