# 99 bottles of beer in Julia

function main()
    bottles = 99
    while bottles > 0
        println("$(bottles) bottles of beer on the wall, $(bottles) bottles of beer.")
        println("Take one down and pass it around, $(bottles - 1) bottles of beer on the wall.")
        bottles -= 1
    end
end

main()
