function navToCartPage() {
    window.location.href = "cart.html";
}

function navToCheckoutPaymentPage() {
    window.location.href = "checkout-payment.html";
}

(function () {
    document.querySelector(".sub-total-price-number").innerText = "$" + parseInt(sessionStorage.getItem("total_price"));
    document.querySelector(".total-price-number").innerText = "$" + parseInt(sessionStorage.getItem("total_price"));
})();
