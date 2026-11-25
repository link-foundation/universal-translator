// Mutual recursion in Swift: the Hofstadter Female and Male sequences

func female(_ index: Int) -> Int {
    if index == 0 {
        return 1
    }
    return index - male(female(index - 1))
}

func male(_ index: Int) -> Int {
    if index == 0 {
        return 0
    }
    return index - female(male(index - 1))
}

for index in 0..<20 {
    print("\(index): \(female(index)) \(male(index))")
}
