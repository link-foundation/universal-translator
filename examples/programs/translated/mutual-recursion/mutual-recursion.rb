# Mutual recursion in Ruby: the Hofstadter Female and Male sequences

def female(index)
    if index == 0
        return 1
    end
    return index - male(female(index - 1))
end

def male(index)
    if index == 0
        return 0
    end
    return index - female(male(index - 1))
end

for index in 0...20
    puts "#{index}: #{female(index)} #{male(index)}"
end
