// 99 bottles of beer in JavaScript

let bottles = 99;
while (bottles > 0) {
    console.log(`${bottles} bottles of beer on the wall, ${bottles} bottles of beer.`);
    console.log(`Take one down and pass it around, ${bottles - 1} bottles of beer on the wall.`);
    bottles -= 1;
}
