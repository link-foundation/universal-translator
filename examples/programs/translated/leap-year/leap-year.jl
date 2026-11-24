# Leap year in Julia

function is_leap_year(year)
    return (year % 4 == 0 && year % 100 != 0) || year % 400 == 0
end

function main()
    for year in 1896:1912
        if is_leap_year(year)
            println("$(year) is a leap year")
        else
            println("$(year) is not a leap year")
        end
    end
end

main()
