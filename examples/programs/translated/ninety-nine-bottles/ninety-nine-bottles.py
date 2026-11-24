# 99 bottles of beer in Python

bottles = 99
while bottles > 0:
    print(f"{bottles} bottles of beer on the wall, {bottles} bottles of beer.")
    print(f"Take one down and pass it around, {bottles - 1} bottles of beer on the wall.")
    bottles -= 1
