# Mutual recursion in Julia: the Hofstadter Female and Male sequences

function female(index)
    if index == 0
        return 1
    end
    return index - male(female(index - 1))
end

function male(index)
    if index == 0
        return 0
    end
    return index - female(male(index - 1))
end

function main()
    for index in 0:19
        println("$(index): $(female(index)) $(male(index))")
    end
end

main()
