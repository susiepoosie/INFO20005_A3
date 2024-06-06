function navToCheckoutShippingPage() {
    window.location.href = "checkout-shipping.html";
}

function navToShoppingPage() {
    window.location.href = "browse-belts.html";
}

(function () {
    var total_price = 0;

    for (var i = 0; i < sessionStorage.length; i++) {
        if (sessionStorage.key(i) !== "total_price") {
            const product_info = JSON.parse(sessionStorage.key(i)).product_info;
            var product_quantity = parseInt(sessionStorage.getItem(sessionStorage.key(i)));

            const product_img_url = product_info.product_img_url;
            const product_type = product_info.product_type;
            const product_name = product_info.product_name;
            const product_color = product_info.product_color;
            const product_size = product_info.product_size;
            const product_price = product_info.product_price;

            total_price += product_price * product_quantity;

            document.querySelector(".cart-items").innerHTML += `<div class="cart-item">
            <div class="product-detail">

                <img class="product-img" src=${product_img_url} alt="Brown Tip Belt">


                <div class="product-title">
                    <div class="product-type">${product_type}</div>
                    <div class="product-name">${product_name}</div>
                </div>

                <div class="product-color-and-size-container">
                    <div class="product-color">${product_color}</div>
                    <div class="product size">${product_size}"</div>
                </div>
            </div>
            <div class="quantity-controls">
                <button class="quantity-btn minus">-</button>
                <input type="text" value=${product_quantity}>
                <button class="quantity-btn plus">+</button>
            </div>
            <div class="product-subtotal">
                <span>$55</span>
            </div>
        </div>`
        }
    }

    sessionStorage.setItem("total_price", total_price);
    document.querySelector(".cart-total-price").innerText = "$" + total_price;
})();