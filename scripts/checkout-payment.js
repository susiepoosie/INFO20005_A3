function navToCartPage() {
    window.location.href = "cart.html";
}

function navToConfirmationPage() {
    window.location.href = "checkout-confirmation.html";
}

(function () {
    document.getElementById("sub-total-price-number").innerText = "$" + parseInt(sessionStorage.getItem("total_price"));
    document.getElementById("total-price-number").innerText = "$" + parseInt(sessionStorage.getItem("total_price"));
})();