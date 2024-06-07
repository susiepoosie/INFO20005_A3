document.addEventListener('DOMContentLoaded', function() {
    var buttons = document.querySelectorAll('button');

    buttons.forEach(function(button) {
        button.addEventListener('click', function(event) {
            event.preventDefault();
        });
    });
});

(function () {
    const quantityContainer = document.querySelector(".quantity");
    const minusBtn = quantityContainer.querySelector(".minus");
    const plusBtn = quantityContainer.querySelector(".plus");
    const inputBox = quantityContainer.querySelector(".input-box");
    updateButtonStates();
    quantityContainer.addEventListener("click", handleButtonClick);
    inputBox.addEventListener("input", handleQuantityChange);

    function updateButtonStates() {
        const value = parseInt(inputBox.value);
        minusBtn.disabled = value <= 1;
        plusBtn.disabled = value >= parseInt(inputBox.max);
    }

    function handleButtonClick(event) {
        if (event.target.classList.contains("minus") || event.target.classList.contains("fi-bs-minus")) {
            decreaseValue();
        } else if (event.target.classList.contains("plus") || event.target.classList.contains("fi-bs-plus")) {
            increaseValue();
        }
    }

    function decreaseValue() {
        let value = parseInt(inputBox.value);
        value = isNaN(value) ? 1 : Math.max(value - 1, 1);
        inputBox.value = value;
        updateButtonStates();
        handleQuantityChange();
    }

    function increaseValue() {
        let value = parseInt(inputBox.value);
        value = isNaN(value) ? 1 : Math.min(value + 1, parseInt(inputBox.max));
        inputBox.value = value;
        updateButtonStates();
        handleQuantityChange();
    }

    function handleQuantityChange() {
        let value = parseInt(inputBox.value);
        value = isNaN(value) ? 1 : value;

        console.log("Quantity changed:", value);
    }
})();

function saveItemInfo() {
    const product_type = "Belts";
    let product_name;
    let product_price;
    let colourValue = document.getElementById("colours").value;
    const product_color = colourValue.toString().charAt(0).toUpperCase() + colourValue.slice(1);
    let product_img_url;

    const first_img_url_on_page = document.querySelector("img").getAttribute("src");
    if (first_img_url_on_page.includes("Belt_Tip")) {
        product_name = "TIP BELT";
        product_price = 55;
        product_img_url = `images/Belt_Tip_${product_color}.png`;
    } else if (first_img_url_on_page.includes("Belt_1.5inch")) {
        product_name = '1.5" BELT';
        product_price = 65;
        product_img_url = `images/Belt_1.5inch_${product_color}.png`;
    } else if (first_img_url_on_page.includes("Belt_Doublekeep")) {
        product_name = 'DOUBLE KEEP BELT';
        product_price = 80;
        product_img_url = `images/Belt_Doublekeep_${product_color}.png`;
    } else if (first_img_url_on_page.includes("Belt_Kangaroolink")) {
        product_name = 'MARANOA LINK BELT';
        product_price = 90;
        product_img_url = `images/Belt_Kangaroolink_${product_color}.png`;
    } else if (first_img_url_on_page.includes("Belt_Crossover")) {
        product_name = 'CROSSOVER STITCHED BELT';
        product_price = 60;
        product_img_url = `images/Belt_Crossover_${product_color}.png`;
    } else if (first_img_url_on_page.includes("Belt_Drover")) {
        product_name = 'DROVER BELT';
        product_price = 90;
        product_img_url = `images/Belt_Drover_${product_color}.png`;
    } else if (first_img_url_on_page.includes("Belt_Queenslander")) {
        product_name = 'QUEENSLANDER BELT';
        product_price = 90;
        product_img_url = `images/Belt_Queenslander_${product_color}2.png`;
    }

    const product_size = document.getElementById("sizes").value;
    const product_quantity = document.querySelector(".quantity").querySelector(".input-box").value;

    const product_info = {
        product_info: {
            product_img_url: product_img_url,
            product_type: product_type,
            product_name: product_name,
            product_color: product_color,
            product_size: product_size,
            product_price: product_price,
        }
    };

    alert("Successfully Add to Cart.");

    sessionStorage.setItem(JSON.stringify(product_info), product_quantity);
}